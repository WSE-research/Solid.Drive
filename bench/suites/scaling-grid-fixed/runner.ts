/**
 * @packageDocumentation
 * Catalog-append latency across catalog size and concurrency, the fixed-size
 * sibling of scaling-grid. The original lets each catalog grow through a cell,
 * so later appends hit a bigger catalog than earlier ones. This variant seeds a
 * fresh catalog at the target size before every round, so every append in a cell
 * is measured at the same size. Results land under the scaling-grid-fixed suite
 * so the two never mix.
 *
 * A cell fixes a catalog size and a writer count, then repeats a round until it
 * has about runs-per-cell appends: seed one catalog per writer to the target
 * size, fire one append each against a 30 s deadline, delete them. The catalog
 * URLs carry the round number, so an append that missed its deadline but still
 * lands on the server writes where no later round reads, and a straggler cannot
 * skew a later size. The stats cover only the appends that beat the deadline; the
 * timeout and error shares sit next to them. Deep, low-concurrency cells run
 * slowest, since they need the most rounds.
 *
 * Clients here means concurrent operations from one process over one session,
 * not separate machines. Throughput is the append rate inside a round and leaves
 * out the resets. The --size-kb flag only sets a dcat:byteSize value on the row;
 * no binary of that size is uploaded, so it is metadata, not bytes on the wire.
 */

import { hostname } from "node:os";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { provisionSession } from "../../lib/podSession.ts";
import { patchAppend, putAppend, seedCatalog } from "../../lib/catalogWriteMethods.ts";
import { catalogEntryMaker } from "../../lib/catalogEntry.ts";
import { stats } from "../../lib/stats.ts";
import { writeRawData, type Column } from "../../lib/rawData.ts";
import type { AuthFetch } from "../../lib/auth.ts";
import type { CatalogAppend } from "../../lib/buildN3Patch.ts";

const SUPPORTED_METHODS = new Set(["put", "n3patch"]);
const KNOWN_FLAGS = new Set([
  "--base-url", "--catalog-sizes", "--client-levels", "--methods",
  "--runs-per-cell", "--deadline-ms", "--size-kb", "--label", "--abort-pct",
]);

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
}

function positiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

function positiveIntList(value: string, flag: string): number[] {
  const parsed = value.split(",").map((part) => Number(part.trim()));
  for (const entry of parsed) {
    if (!Number.isInteger(entry) || entry <= 0) {
      throw new Error(`${flag} must be a comma-separated list of positive integers, got "${value}"`);
    }
  }
  // The early-abort assumes a harder cell comes later in the ladder, so sort here
  // and it holds whatever order the flag was given in.
  return [...new Set(parsed)].sort((left, right) => left - right);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseUrl: "",
    catalogSizes: [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384],
    clientLevels: [8, 16, 24, 32, 40, 48, 56, 64, 96, 128, 192, 256],
    methods: ["put"],
    runsPerCell: 500,
    deadlineMs: 30000,
    byteSize: 64 * 1024,
    label: "",
    // Stop climbing writers for a catalog once its timeout share reaches this
    // percent. Not an error: the run still exits 0.
    abortPct: 100,
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!KNOWN_FLAGS.has(flag)) throw new Error(`unknown flag: ${flag}`);
    if (value === undefined) throw new Error(`missing value for ${flag}`);
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--catalog-sizes") args.catalogSizes = positiveIntList(value, flag);
    else if (flag === "--client-levels") args.clientLevels = positiveIntList(value, flag);
    else if (flag === "--methods") args.methods = value.split(",").map((method) => method.trim());
    else if (flag === "--runs-per-cell") args.runsPerCell = positiveInt(value, flag);
    else if (flag === "--deadline-ms") args.deadlineMs = positiveInt(value, flag);
    else if (flag === "--size-kb") args.byteSize = positiveInt(value, flag) * 1024;
    else if (flag === "--label") args.label = value;
    else if (flag === "--abort-pct") args.abortPct = Number(value);
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  for (const method of args.methods) {
    if (!SUPPORTED_METHODS.has(method)) {
      throw new Error(`unsupported method "${method}" (expected one of ${[...SUPPORTED_METHODS].join(", ")})`);
    }
  }
  if (!(args.abortPct > 0 && args.abortPct <= 100)) {
    throw new Error(`--abort-pct must be within (0, 100], got "${args.abortPct}"`);
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 200);
}

/** Caps how long a cleanup call can take, so one slow delete can't hang the whole run. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), ms); });
  return Promise.race([promise.then((value) => { clearTimeout(timer); return value; }), bound]);
}

/**
 * Runs fn over items with bounded concurrency, for setup work. After the first
 * failure it stops handing out new items, lets the running ones finish, then
 * rethrows, so a failed seed does not bleed workers into the next cell.
 */
async function mapPool<T>(items: T[], poolSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  let failure: unknown;
  const worker = async (): Promise<void> => {
    while (failure === undefined && cursor < items.length) {
      const item = items[cursor++];
      try {
        await fn(item);
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(poolSize, items.length) }, worker));
  if (failure !== undefined) throw failure;
}

const makeEntry = catalogEntryMaker(ARGS.byteSize);

const appendForMethod = (method: string): typeof putAppend => (method === "n3patch" ? patchAppend : putAppend);

type Outcome = { latencyMs: number } | { fail: "timeout" | "error" };

/** One append raced against the deadline: a latency on success, else the failure kind. */
async function timedAppend(append: typeof putAppend, authFetch: AuthFetch, catalogUri: string, entry: CatalogAppend, deadlineMs: number): Promise<Outcome> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), deadlineMs); });
  const op = append(authFetch, catalogUri, entry).then(() => "ok" as const).catch(() => "error" as const);
  const outcome = await Promise.race([op, deadline]);
  clearTimeout(timer);
  const elapsed = performance.now() - start;
  if (outcome !== "ok") return { fail: outcome };
  // A busy event loop can hold the timer past the deadline, so an append can win
  // the race yet have run long. Check the elapsed time and count that as a timeout.
  if (elapsed > deadlineMs) return { fail: "timeout" };
  return { latencyMs: elapsed };
}

type CellStatus = "ok" | "saturated" | "setup_failed" | "error";

interface Row extends Record<string, unknown> {
  method: string;
  catalogEntries: number;
  clients: number;
  rounds: number;
  attempts: number;
  successes: number;
  timeouts: number;
  errors: number;
  timeoutPct: number;
  errorPct: number;
  status: CellStatus;
  failurePhase: string;
  errorReason: string;
  meanMs: number | null;
  sdMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  throughputOpsPerSec: number | null;
}

// Best-effort, bounded delete so cleanup never throws or hangs the run.
async function deleteCatalogs(authFetch: AuthFetch, catalogs: string[]): Promise<void> {
  await Promise.all(catalogs.map((catalogUri) =>
    withTimeout(authFetch(catalogUri, { method: "DELETE" }), 10000).catch(() => undefined),
  ));
}

async function runCell(authFetch: AuthFetch, pod: string, webId: string, method: string, catalogEntries: number, clients: number): Promise<Row> {
  const append = appendForMethod(method);
  const cellTag = `${method}-s${catalogEntries}-c${clients}`;

  const latencies: number[] = [];
  let timeouts = 0;
  let errors = 0;
  let measuredMs = 0;
  let roundsRun = 0;
  let status: CellStatus = "ok";
  let failurePhase = "";
  let errorReason = "";
  const rounds = Math.max(1, Math.ceil(ARGS.runsPerCell / clients));

  for (let round = 0; round < rounds && status === "ok"; round++) {
    // Round-tagged URLs: an append that times out but still lands writes here,
    // where no later round reads it.
    const catalogs = Array.from({ length: clients }, (_unused, worker) => `${pod}bench-grid/cat-${cellTag}-r${round}-w${worker}.ttl`);
    try {
      await mapPool(catalogs, 16, (catalogUri) =>
        seedCatalog(authFetch, catalogUri, catalogEntries, (index) => ({
          ...makeEntry(pod, webId, `seed-${cellTag}-w-${index}`), catalogUri,
        })),
      );
    } catch (error) {
      // Seeding broke before any append ran. Record why, keep the rounds already
      // measured, and don't pass it off as saturation.
      status = "setup_failed";
      failurePhase = "setup";
      errorReason = describeError(error);
      await deleteCatalogs(authFetch, catalogs);
      break;
    }
    try {
      const roundStart = performance.now();
      const outcomes = await Promise.all(
        catalogs.map((catalogUri, worker) => {
          const entry = { ...makeEntry(pod, webId, `append-${cellTag}-r${round}-w${worker}`), catalogUri };
          return timedAppend(append, authFetch, catalogUri, entry, ARGS.deadlineMs);
        }),
      );
      measuredMs += performance.now() - roundStart;
      for (const outcome of outcomes) {
        if ("latencyMs" in outcome) latencies.push(outcome.latencyMs);
        else if (outcome.fail === "timeout") timeouts += 1;
        else errors += 1;
      }
      roundsRun += 1;
    } finally {
      await deleteCatalogs(authFetch, catalogs);
    }
  }

  const attempts = clients * roundsRun;
  if (status === "ok" && attempts > 0 && (100 * timeouts) / attempts >= ARGS.abortPct) status = "saturated";
  const summary = latencies.length ? stats(latencies) : undefined;
  const wallSeconds = measuredMs / 1000;
  return {
    method, catalogEntries, clients, rounds: roundsRun, attempts,
    successes: latencies.length, timeouts, errors,
    timeoutPct: attempts ? (100 * timeouts) / attempts : 0,
    errorPct: attempts ? (100 * errors) / attempts : 0,
    status, failurePhase, errorReason,
    meanMs: summary ? summary.mean : null,
    sdMs: summary ? summary.stddev : null,
    p50Ms: summary ? summary.p50 : null,
    p95Ms: summary ? summary.p95 : null,
    p99Ms: summary ? summary.p99 : null,
    throughputOpsPerSec: wallSeconds > 0 ? latencies.length / wallSeconds : null,
  };
}

const fixed1 = (value: number | null): string => (value === null ? "-" : value.toFixed(1));

function printTable(rows: Row[]): void {
  console.log("\n| method | catalog | clients | rounds | ok | timeout% | err% | status | mean ms | SD | p95 | ops/s |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.method} | ${row.catalogEntries} | ${row.clients} | ${row.rounds} | ${row.successes} | ` +
      `${row.timeoutPct.toFixed(1)} | ${row.errorPct.toFixed(1)} | ${row.status} | ${fixed1(row.meanMs)} | ` +
      `${fixed1(row.sdMs)} | ${fixed1(row.p95Ms)} | ${fixed1(row.throughputOpsPerSec)} |`,
    );
  }
}

const COLUMNS: Array<Column<Row>> = [
  { key: "method", header: "method" },
  { key: "catalogEntries", header: "catalog_entries" },
  { key: "clients", header: "clients" },
  { key: "rounds", header: "rounds" },
  { key: "attempts", header: "attempts" },
  { key: "successes", header: "successes" },
  { key: "timeouts", header: "timeouts" },
  { key: "errors", header: "errors" },
  { key: "timeoutPct", header: "timeout_pct" },
  { key: "errorPct", header: "error_pct" },
  { key: "status", header: "status" },
  { key: "failurePhase", header: "failure_phase" },
  { key: "errorReason", header: "error_reason" },
  { key: "meanMs", header: "mean_ms" },
  { key: "sdMs", header: "sd_ms" },
  { key: "p50Ms", header: "p50_ms" },
  { key: "p95Ms", header: "p95_ms" },
  { key: "p99Ms", header: "p99_ms" },
  { key: "throughputOpsPerSec", header: "throughput_ops_per_s" },
];

const RAW_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../results/raw");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const checkpointPath = (label: string): string => resolve(RAW_DIR, `scaling-grid-fixed_${label}_${RUN_ID}.checkpoint.json`);

// Rewrite every row after each cell, so a Ctrl+C or a crash keeps the cells
// already finished.
function checkpoint(label: string, rows: Row[]): void {
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(checkpointPath(label), `${JSON.stringify({ runId: RUN_ID, rows }, null, 2)}\n`);
}

async function main(): Promise<void> {
  console.log(`base URL      ${ARGS.baseUrl}`);
  console.log(`methods       ${ARGS.methods.join(", ")}`);
  console.log(`catalog sizes ${ARGS.catalogSizes.join(", ")}`);
  console.log(`client levels ${ARGS.clientLevels.join(", ")}`);
  console.log(`runs/cell     ${ARGS.runsPerCell}   deadline ${ARGS.deadlineMs} ms   entry byteSize ${(ARGS.byteSize / 1024).toFixed(0)} KB (metadata only)   (fixed size: fresh catalogs each round)`);

  const suffix = `sgf${Date.now().toString(36)}`;
  const { authFetch, pod: podUrl, webId, serverHeader } = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server        ${serverHeader}`);
  console.log(`pod           ${podUrl}\n`);

  const label = ARGS.label || serverHeader.split("/")[0] || hostname();
  const rows: Row[] = [];

  try {
    for (const method of ARGS.methods) {
      for (const catalogEntries of ARGS.catalogSizes) {
        for (const clients of ARGS.clientLevels) {
          process.stdout.write(`running ${method} catalog=${catalogEntries} clients=${clients} ... `);
          let row: Row;
          try {
            row = await runCell(authFetch, podUrl, webId, method, catalogEntries, clients);
          } catch (error) {
            // runCell handles seed and append failures itself, so reaching here is
            // a real bug. Record it and stop this catalog's ladder.
            console.log(`ERROR (${describeError(error).slice(0, 90)})`);
            row = {
              method, catalogEntries, clients, rounds: 0, attempts: 0, successes: 0, timeouts: 0, errors: 0,
              timeoutPct: 0, errorPct: 0, status: "error", failurePhase: "unknown", errorReason: describeError(error),
              meanMs: null, sdMs: null, p50Ms: null, p95Ms: null, p99Ms: null, throughputOpsPerSec: null,
            };
            rows.push(row);
            checkpoint(label, rows);
            break;
          }
          const meanText = row.meanMs === null ? "no successes" : `mean ${row.meanMs.toFixed(1)} ms`;
          console.log(`${row.successes} ok, ${row.timeoutPct.toFixed(1)}% timeout, ${meanText} [${row.status}]`);
          rows.push(row);
          checkpoint(label, rows);
          if (row.status === "setup_failed") {
            console.log(`  setup failed at clients=${clients} (${row.errorReason}); skipping higher client counts for catalog=${catalogEntries}.`);
            break;
          }
          if (row.status === "saturated") {
            console.log(`  saturated at clients=${clients} (${row.timeoutPct.toFixed(0)}% >= ${ARGS.abortPct}%); skipping higher client counts for catalog=${catalogEntries}.`);
            break;
          }
        }
      }
    }
  } finally {
    if (rows.length > 0) {
      printTable(rows);
      const paths = writeRawData<Row>(label, {
        suite: "scaling-grid-fixed",
        server: serverHeader,
        baseUrl: ARGS.baseUrl,
        commit: process.env.BENCH_COMMIT ?? "unknown",
        runsPerPoint: ARGS.runsPerCell,
        deadlineMs: ARGS.deadlineMs,
        notes: `fixed-size catalog-append ${ARGS.methods.join("+")}; fresh catalogs per round; entry declares ${(ARGS.byteSize / 1024).toFixed(0)} KB byteSize (metadata, no binary uploaded); mean over successful requests only`,
      }, COLUMNS, rows);
      console.log(`\nwrote ${paths.json}\n      ${paths.csv}`);
      // Canonical files are written; drop the checkpoint so the raw dir keeps one
      // file per run.
      try {
        rmSync(checkpointPath(label));
      } catch {
        // Nothing to remove.
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
