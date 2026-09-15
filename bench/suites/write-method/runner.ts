/**
 * @packageDocumentation
 * Write-method experiment: two ways to add one entry to a catalog, compared on a
 * live Community Solid Server.
 *
 * A pod keeps a "catalog", one RDF Turtle document listing every file it holds.
 * Each delete appends a line to the trash catalog so the trash view can show what was deleted,
 * so a delete is only as fast as that append.
 *
 * GET+PUT method, which is our current approach, downloads the whole catalog, 
 * adds the entry, and uploads the whole document back, so it gets slower as the catalog grows. 
 * N3 Patch sends an HTTP PATCH with only the new lines, so the request itself remains
 * small at any size. 
 * 
 * This runner sweeps catalog size and times each method's append. 
 * It is noteworthy that the server still applies a patch by rewriting the file,
 * so the saving is in bytes sent and client memory, not necessarily end-to-end time.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { provisionSession } from "../../lib/podSession.ts";
import { patchAppend, putAppend, seedCatalog } from "../../lib/catalogWriteMethods.ts";
import { catalogEntryMaker } from "../../lib/catalogEntry.ts";
import type { AuthFetch } from "../../lib/auth.ts";
import { stats } from "../../lib/stats.ts";
import { writeRawData, type Column } from "../../lib/rawData.ts";

interface Args {
  baseUrl: string;
  catalogSizes: number[];
  levels: number[];
  repeats: number;
  methods: string[];
  byteSize: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseUrl: "https://wse-research.org/solid-community-server/",
    catalogSizes: [16, 64],
    levels: [1, 10],
    repeats: 3,
    methods: ["put", "n3patch"],
    byteSize: 64 * 1024,
  };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--catalog-sizes") args.catalogSizes = value.split(",").map(Number);
    else if (flag === "--levels") args.levels = value.split(",").map(Number);
    else if (flag === "--repeats") args.repeats = Number(value);
    else if (flag === "--methods") args.methods = value.split(",");
    else if (flag === "--size-kb") args.byteSize = Number(value) * 1024;
  }
  return args;
}

// Runs fn over items with at most poolSize in flight at once.
async function mapPool<T>(items: T[], poolSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(poolSize, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}

const ARGS = parseArgs(process.argv.slice(2));

const appendForMethod = (method: string) => (method === "n3patch" ? patchAppend : putAppend);
const makeEntry = catalogEntryMaker(ARGS.byteSize);

interface Row extends Record<string, unknown> {
  method: string;
  catalogSize: number;
  concurrency: number;
  count: number;
  mean: number;
  stddev: number;
  p50: number;
  p95: number;
  p99: number;
  opsPerSecond: number;
}

const RAW_COLUMNS: Array<Column<Row>> = [
  { key: "method", header: "method" },
  { key: "catalogSize", header: "catalog_entries" },
  { key: "concurrency", header: "clients" },
  { key: "count", header: "successes" },
  { key: "mean", header: "mean_ms" },
  { key: "stddev", header: "sd_ms" },
  { key: "p50", header: "p50_ms" },
  { key: "p95", header: "p95_ms" },
  { key: "p99", header: "p99_ms" },
  { key: "opsPerSecond", header: "throughput_ops_per_s" },
];

/**
 * One grid cell: for a fixed method, catalog size, and client count, seed a fresh
 * catalog per client and time all the appends firing at once, over several rounds.
 * Returns the cell's latency summary and throughput.
 */
async function runCell(
  authFetch: AuthFetch,
  pod: string,
  webId: string,
  method: string,
  catalogSize: number,
  concurrency: number,
): Promise<Row> {
  const latencies: number[] = [];
  const batchWallsMs: number[] = [];

  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    const workers = Array.from({ length: concurrency }, (_unused, worker) => {
      const tag = `${method}-s${catalogSize}-c${concurrency}-r${repeat}-w${worker}`;
      const catalogUri = `${pod}bench-catalogs/cat-${tag}.ttl`;
      return { catalogUri, tag };
    });

    // Setup, not timed: fill each client's catalog to size before the append.
    await mapPool(workers, 16, ({ catalogUri, tag }) =>
      seedCatalog(authFetch, catalogUri, catalogSize, (index) => ({
        ...makeEntry(pod, webId, `seed-${tag}-${index}`),
        catalogUri,
      })),
    );

    // run the append for all workers in parallel,
    // measuring each latency and the total wall time for the batch.
    const append = appendForMethod(method);
    const batchStart = performance.now();
    await Promise.all(
      workers.map(async ({ catalogUri, tag }) => {
        const entry = { ...makeEntry(pod, webId, `append-${tag}`), catalogUri };
        const start = performance.now();
        await append(authFetch, catalogUri, entry);
        latencies.push(performance.now() - start);
      }),
    );
    batchWallsMs.push(performance.now() - batchStart);
  }

  const summary = stats(latencies);
  const totalOps = concurrency * ARGS.repeats;
  const totalWallSeconds = batchWallsMs.reduce((sum, ms) => sum + ms, 0) / 1000;
  return {
    method, catalogSize, concurrency,
    count: summary.count, mean: summary.mean, stddev: summary.stddev,
    p50: summary.p50, p95: summary.p95, p99: summary.p99,
    opsPerSecond: totalWallSeconds > 0 ? totalOps / totalWallSeconds : 0,
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| method | catalog size | concurrency | mean (ms) | SD | p50 | p95 | p99 | ops/s |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.method} | ${row.catalogSize} | ${row.concurrency} | ${row.mean.toFixed(1)} | ${row.stddev.toFixed(1)} | ` +
      `${row.p50.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.opsPerSecond.toFixed(1)} |`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`base URL ${ARGS.baseUrl}`);
  console.log(`methods ${ARGS.methods.join(", ")}`);
  console.log(`catalog size ${ARGS.catalogSizes.join(", ")}`);
  console.log(`concurrency ${ARGS.levels.join(", ")}`);
  console.log(`repeats ${ARGS.repeats}`);

  const suffix = `wm${Date.now().toString(36)}`;
  const { authFetch, pod: podUrl, webId, serverHeader } = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server ${serverHeader}`);
  console.log(`pod ${podUrl}\n`);

  const rows: Row[] = [];
  for (const method of ARGS.methods) {
    for (const catalogSize of ARGS.catalogSizes) {
      for (const concurrency of ARGS.levels) {
        process.stdout.write(`running ${method} size=${catalogSize} C=${concurrency} ... `);
        const row = await runCell(authFetch, podUrl, webId, method, catalogSize, concurrency);
        console.log(`mean ${row.mean.toFixed(1)} ms, ${row.opsPerSecond.toFixed(1)} ops/s`);
        rows.push(row);
      }
    }
  }

  printTable(rows);

  const resultsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../results");
  mkdirSync(resultsDir, { recursive: true });
  const outPath = resolve(resultsDir, `write-method-${suffix}.json`);
  writeFileSync(outPath, JSON.stringify({ args: ARGS, server: serverHeader, pod: podUrl, webId, rows, timestamp: new Date().toISOString() }, null, 2));

  const label = process.env.BENCH_LABEL || serverHeader.split("/")[0] || "server";
  const raw = writeRawData<Row>(label, {
    suite: "write-method",
    server: serverHeader,
    baseUrl: ARGS.baseUrl,
    commit: process.env.BENCH_COMMIT ?? "unknown",
    runsPerPoint: ARGS.repeats,
    notes: `catalog append ${ARGS.methods.join("+")}; ${(ARGS.byteSize / 1024).toFixed(0)} KB entry payload; single-client dense size sweep`,
  }, RAW_COLUMNS, rows);
  console.log(`\nwrote ${outPath}\n ${raw.json}\n ${raw.csv}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
