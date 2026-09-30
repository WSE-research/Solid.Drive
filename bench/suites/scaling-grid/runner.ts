/**
 * @packageDocumentation
 * Measures how long it takes to add one entry to a Solid pod's catalog,
 * against a live Solid server, across the full grid of catalog size and
 * writer count. One run measures the whole grid, so we can read it
 * both ways without measuring twice.
 *
 * Each cell seeds one catalog per writer to the target size, then has every
 * writer append once under a 30 s deadline. It reports the average, spread, and
 * percentiles of the appends that finished within the deadline.
 *
 * With --shared-catalog every writer in a cell appends to the SAME catalog
 * instead of its own
 * The cell then counts how many appends actually
 * landed, and reports successes-minus-landed as lost updates.
 *
 * Known limitation: an append that misses its deadline can still land on
 * the server afterward, growing the catalog by an entry.
 */

import { hostname } from "node:os";
import { Parser } from "n3";
import { provisionSession } from "../../lib/podSession.ts";
import { patchAppend, putAppend, seedCatalog } from "../../lib/catalogWriteMethods.ts";
import { DCAT_NS } from "../../lib/rdfNamespaces.ts";
import { catalogEntryMaker } from "../../lib/catalogEntry.ts";
import { stats } from "../../lib/stats.ts";
import { writeRawData, type Column } from "../../lib/rawData.ts";
import type { AuthFetch } from "../../lib/auth.ts";
import type { CatalogAppend } from "../../lib/buildN3Patch.ts";

interface Args {
  baseUrl: string;
  catalogSizes: number[];
  clientLevels: number[];
  methods: string[];
  runsPerCell: number;
  deadlineMs: number;
  byteSize: number;
  label: string;
  abortPct: number;
  sharedCatalog: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseUrl: "",
    catalogSizes: [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384],
    clientLevels: [8, 16, 24, 32, 40, 48, 56, 64, 96, 128, 192, 256],
    methods: ["put"],
    runsPerCell: 1000,
    deadlineMs: 30000,
    byteSize: 64 * 1024,
    label: "",
    abortPct: 100,
    sharedCatalog: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--shared-catalog") { args.sharedCatalog = true; continue; }
    const value = argv[++index];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--catalog-sizes") args.catalogSizes = value.split(",").map(Number);
    else if (flag === "--client-levels") args.clientLevels = value.split(",").map(Number);
    else if (flag === "--methods") args.methods = value.split(",");
    else if (flag === "--runs-per-cell") args.runsPerCell = Number(value);
    else if (flag === "--deadline-ms") args.deadlineMs = Number(value);
    else if (flag === "--size-kb") args.byteSize = Number(value) * 1024;
    else if (flag === "--label") args.label = value;
    else if (flag === "--abort-pct") args.abortPct = Number(value);
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

// Runs fn over items with at most poolSize in flight at once.
async function mapPool<T>(items: T[], poolSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(poolSize, items.length) }, async () => {
    while (cursor < items.length) await fn(items[cursor++]);
  });
  await Promise.all(workers);
}

const makeEntry = catalogEntryMaker(ARGS.byteSize);

const appendForMethod = (method: string) => (method === "n3patch" ? patchAppend : putAppend);

type Outcome = { latencyMs: number } | { fail: "timeout" } | { fail: "error"; status: number };
function statusOf(error: unknown): number {
  const match = /-> (\d{3})/.exec(error instanceof Error ? error.message : String(error));
  return match ? Number(match[1]) : 0;
}

// Times one append to a catalog, returning the latency or failure reason.
async function timedAppend(append: typeof putAppend, authFetch: AuthFetch, catalogUri: string, entry: CatalogAppend, deadlineMs: number): Promise<Outcome> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), deadlineMs); });
  const op = append(authFetch, catalogUri, entry).then(() => "ok" as const).catch((error: unknown) => error);
  const outcome = await Promise.race([op, deadline]);
  clearTimeout(timer);
  if (outcome === "ok") return { latencyMs: performance.now() - start };
  if (outcome === "timeout") return { fail: "timeout" };
  return { fail: "error", status: statusOf(outcome) };
}

interface Row extends Record<string, unknown> {
  method: string;
  catalogEntries: number;
  clients: number;
  attempts: number;
  successes: number;
  timeouts: number;
  errors: number;
  timeoutPct: number;
  errorPct: number;
  meanMs: number;
  sdMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughputOpsPerSec: number;
  errorStatuses?: string;
  landed?: number;
  lostUpdates?: number;
  samples?: number[];
}

// Counts a catalog's entries by its dcat:dataset membership triples, to see how
// many appends actually survived on a shared catalog.
async function countEntries(authFetch: AuthFetch, catalogUri: string): Promise<number> {
  const response = await authFetch(catalogUri);
  if (!response.ok) return -1;
  const quads = new Parser({ baseIRI: catalogUri }).parse(await response.text());
  const datasetPredicate = `${DCAT_NS}dataset`;
  return quads.filter((entry) => entry.predicate.value === datasetPredicate).length;
}

async function runCell(authFetch: AuthFetch, pod: string, webId: string, method: string, catalogEntries: number, clients: number): Promise<Row> {
  const append = appendForMethod(method);
  const cellTag = `${method}-s${catalogEntries}-c${clients}`;
  const shared = ARGS.sharedCatalog;

  // Isolated: one catalog per writer, so the cell measures pure server throughput.
  // Shared: every writer appends to the same catalog, so concurrent GET+PUT can
  // clobber one another ---> the point of this variant.
  const catalogs = shared
    ? Array.from({ length: clients }, () => `${pod}bench-grid/cat-${cellTag}-shared.ttl`)
    : Array.from({ length: clients }, (_unused, worker) => `${pod}bench-grid/cat-${cellTag}-w${worker}.ttl`);
  const seedTargets = shared ? [catalogs[0]] : catalogs;
  await mapPool(seedTargets, 16, (catalogUri) =>
    seedCatalog(authFetch, catalogUri, catalogEntries, (index) => ({
      ...makeEntry(pod, webId, `seed-${cellTag}-${index}`), catalogUri,
    })),
  );

  const latencies: number[] = [];
  let timeouts = 0;
  let errors = 0;
  const statusCounts = new Map<number, number>();
  const batches = Math.max(1, Math.ceil(ARGS.runsPerCell / clients));
  const measuredStart = performance.now();
  for (let batch = 0; batch < batches; batch++) {
    const outcomes = await Promise.all(
      catalogs.map((catalogUri, worker) => {
        const entry = { ...makeEntry(pod, webId, `append-${cellTag}-b${batch}-w${worker}`), catalogUri };
        return timedAppend(append, authFetch, catalogUri, entry, ARGS.deadlineMs);
      }),
    );
    for (const outcome of outcomes) {
      if ("latencyMs" in outcome) latencies.push(outcome.latencyMs);
      else if (outcome.fail === "timeout") timeouts += 1;
      else {
        errors += 1;
        statusCounts.set(outcome.status, (statusCounts.get(outcome.status) ?? 0) + 1);
      }
    }
  }
  const errorStatuses = [...statusCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([status, count]) => `${status}x${count}`)
    .join(" ");
  const wallSeconds = (performance.now() - measuredStart) / 1000;
  const successes = latencies.length;

  // On a shared catalog, count what actually landed.
  let landed: number | undefined;
  let lostUpdates: number | undefined;
  if (shared) {
    const finalCount = await countEntries(authFetch, seedTargets[0]);
    if (finalCount >= 0) {
      landed = finalCount - catalogEntries;
      lostUpdates = successes - landed;
    }
  }

  await Promise.all(seedTargets.map((catalogUri) => authFetch(catalogUri, { method: "DELETE" }).catch(() => undefined)));
  const attempts = clients * batches;
  const summary = latencies.length ? stats(latencies) : { mean: 0, stddev: 0, p50: 0, p95: 0, p99: 0 };
  return {
    method, catalogEntries, clients, attempts,
    successes, timeouts, errors,
    timeoutPct: (100 * timeouts) / attempts, errorPct: (100 * errors) / attempts,
    meanMs: summary.mean, sdMs: summary.stddev, p50Ms: summary.p50, p95Ms: summary.p95, p99Ms: summary.p99,
    throughputOpsPerSec: wallSeconds > 0 ? latencies.length / wallSeconds : 0,
    errorStatuses,
    landed, lostUpdates,
    samples: latencies,
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| method | catalog | clients | ok | timeout% | err% | mean ms | SD | p95 | ops/s | landed | lost |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.method} | ${row.catalogEntries} | ${row.clients} | ${row.successes} | ${row.timeoutPct.toFixed(1)} | ` +
      `${row.errorPct.toFixed(1)} | ${row.meanMs.toFixed(1)} | ${row.sdMs.toFixed(1)} | ${row.p95Ms.toFixed(1)} | ${row.throughputOpsPerSec.toFixed(1)} | ` +
      `${row.landed ?? "-"} | ${row.lostUpdates ?? "-"} |`,
    );
  }
}

const COLUMNS: Array<Column<Row>> = [
  { key: "method", header: "method" },
  { key: "catalogEntries", header: "catalog_entries" },
  { key: "clients", header: "clients" },
  { key: "attempts", header: "attempts" },
  { key: "successes", header: "successes" },
  { key: "timeouts", header: "timeouts" },
  { key: "errors", header: "errors" },
  { key: "timeoutPct", header: "timeout_pct" },
  { key: "errorPct", header: "error_pct" },
  { key: "meanMs", header: "mean_ms" },
  { key: "sdMs", header: "sd_ms" },
  { key: "p50Ms", header: "p50_ms" },
  { key: "p95Ms", header: "p95_ms" },
  { key: "p99Ms", header: "p99_ms" },
  { key: "throughputOpsPerSec", header: "throughput_ops_per_s" },
  { key: "errorStatuses", header: "error_statuses" },
  { key: "landed", header: "landed" },
  { key: "lostUpdates", header: "lost_updates" },
];

async function main(): Promise<void> {
  console.log(`base URL      ${ARGS.baseUrl}`);
  console.log(`methods       ${ARGS.methods.join(", ")}`);
  console.log(`catalog sizes ${ARGS.catalogSizes.join(", ")}`);
  console.log(`client levels ${ARGS.clientLevels.join(", ")}`);
  console.log(`runs/cell     ${ARGS.runsPerCell}   deadline ${ARGS.deadlineMs} ms   payload ${(ARGS.byteSize / 1024).toFixed(0)} KB`);
  console.log(`catalog mode  ${ARGS.sharedCatalog ? "shared (lost-update check)" : "isolated per writer"}`);

  const suffix = `sg${Date.now().toString(36)}`;
  const { authFetch, pod: podUrl, webId, serverHeader } = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server        ${serverHeader}`);
  console.log(`pod           ${podUrl}\n`);

  const rows: Row[] = [];
  const failedRow = (method: string, catalogEntries: number, clients: number): Row => ({
    method, catalogEntries, clients, attempts: clients, successes: 0, timeouts: 0, errors: clients,
    timeoutPct: 0, errorPct: 100, meanMs: 0, sdMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, throughputOpsPerSec: 0,
  });

  try {
    for (const method of ARGS.methods) {
      for (const catalogEntries of ARGS.catalogSizes) {
        for (const clients of ARGS.clientLevels) {
          process.stdout.write(`running ${method} catalog=${catalogEntries} clients=${clients} ... `);
          let row: Row;
          try {
            row = await runCell(authFetch, podUrl, webId, method, catalogEntries, clients);
          } catch (error) {
            // A failure at high concurrency counts as saturation too; records it
            // and moves on instead of crashing the whole grid.
            console.log(`FAILED (${(error as Error).message.slice(0, 90)}), recording as saturation, skipping higher clients.`);
            rows.push(failedRow(method, catalogEntries, clients));
            break;
          }
          const integrity = ARGS.sharedCatalog && row.landed !== undefined
            ? `, ${row.landed}/${row.successes} landed, ${row.lostUpdates} lost`
            : "";
          const errs = row.errorStatuses ? `, err ${row.errorStatuses}` : "";
          console.log(`${row.successes} ok, ${row.timeoutPct.toFixed(1)}% timeout, mean ${row.meanMs.toFixed(1)} ms${integrity}${errs}`);
          rows.push(row);
          if (row.timeoutPct >= ARGS.abortPct) {
            console.log(`  saturated at clients=${clients} (${row.timeoutPct.toFixed(0)}% ≥ ${ARGS.abortPct}%); skipping higher client counts for catalog=${catalogEntries}.`);
            break;
          }
        }
      }
    }
  } finally {

    if (rows.length > 0) {
      printTable(rows);
      const label = ARGS.label || serverHeader.split("/")[0] || hostname();
      const paths = writeRawData<Row>(label, {
        suite: "scaling-grid",
        server: serverHeader,
        baseUrl: ARGS.baseUrl,
        commit: process.env.BENCH_COMMIT ?? "unknown",
        runsPerPoint: ARGS.runsPerCell,
        deadlineMs: ARGS.deadlineMs,
        notes: `catalog-append ${ARGS.methods.join("+")}; ${(ARGS.byteSize / 1024).toFixed(0)} KB entry payload; ${ARGS.sharedCatalog ? "shared catalog (lost-update integrity)" : "isolated catalogs"}; mean over successful requests only`,
      }, COLUMNS, rows);
      console.log(`\nwrote ${paths.json}\n ${paths.csv}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
