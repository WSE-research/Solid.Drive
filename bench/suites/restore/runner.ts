/**
 * @packageDocumentation
 * Measures how long it takes to restore a file from the pod's trash container,
 * and compares that to how long an ordinary read of a file with the same size takes.
 
 * To answer the latency question in RQ4, we compare the time taken for both
 * operations and measure how much slower a restore is than a plain read.
 * The benchmark varies the file size, the number of existing entries in the
 * trash catalog, and the number of restores or reads running concurrently.
 * Each measurement records the latency, number of HTTP requests, and bytes transferred.
 */

import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { restoreTrashedFile } from "@/features/file-explorer/services/restoreTrashedFile";
import { provisionSession } from "../../lib/podSession";
import { instrumentFetch } from "../../lib/instrumentedFetch";
import { stats } from "../../lib/stats";
import { toFetchFn, type AuthFetch } from "../../lib/auth";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile, type PreparedFile } from "../soft-delete/prepareFile";
import { mapPool, parseGridArgs, meanOf, writeResults, type Sample } from "../soft-delete/runnerShared";
import { purgeContainer } from "../../lib/purge";

const ARGS = parseGridArgs(process.argv.slice(2), {
  sizesKb: [16, 256],
  trashSizes: [0],
  methods: ["restore", "read"],
  concurrency: [1],
  repeats: 3,
});

// Times one restore, capturing latency plus the request and byte counts.
async function measureRestore(base: AuthFetch, webId: string, file: PreparedFile, trashItemContainerUri: string): Promise<Sample> {
  const { fetch: metered, metrics } = instrumentFetch(base);
  const start = performance.now();
  const result = await restoreTrashedFile({
    trashItemContainerUri, storageRootUri: file.storageRoot,
    entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: toFetchFn(metered),
  });
  if (!result.ok) throw new Error(`restore failed: ${result.reason}`);
  return { latencyMs: performance.now() - start, requests: metrics.requests, bytesSent: metrics.bytesSent, bytesReceived: metrics.bytesReceived };
}

// Reads a file from the pod and returns the latency and bytes transferred.
async function measureRead(base: AuthFetch, file: PreparedFile): Promise<Sample> {
  const { fetch: metered, metrics } = instrumentFetch(base);
  const start = performance.now();
  const response = await metered(file.descriptor.layout.binaryUri, { method: "GET" });
  if (!response.ok) throw new Error(`read failed: ${response.status}`);
  await response.arrayBuffer();
  return { latencyMs: performance.now() - start, requests: metrics.requests, bytesSent: metrics.bytesSent, bytesReceived: metrics.bytesReceived };
}

interface Row {
  method: string;
  sizeKb: number;
  trashSize: number;
  concurrency: number;
  meanMs: number;
  stddevMs: number;
  p50: number;
  p95: number;
  p99: number;
  meanRequests: number;
  meanKbReceived: number;
}

// One grid cell: for a fixed method, size, trash size, and client count, prepare fresh files each round, measure the op, and return the aggregates.
async function runCell(base: AuthFetch, pod: string, webId: string, method: string, sizeKb: number, trashSize: number, concurrency: number): Promise<Row> {
  const samples: Sample[] = [];
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    const tag = `${method}-s${sizeKb}-t${trashSize}-c${concurrency}-r${repeat}`;
    const workers = Array.from({ length: concurrency }, (_unused, worker) => worker);
    const prepared = await mapPool(workers, Math.min(8, concurrency), () => prepareFile(base, pod, webId, sizeKb, trashSize, tag));

    let batch: Sample[];
    if (method === "restore") {
      const trashed = await mapPool(prepared, Math.min(8, concurrency), async (file) => {
        const del = await softDeleteFile({
          containerUri: file.descriptor.layout.containerUri, storageRootUri: file.storageRoot,
          catalogUri: file.mainCatalogUri, entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: toFetchFn(base),
        });
        if (!del.ok) throw new Error(`setup soft-delete failed: ${del.reason}`);
        return { file, trash: del.trashItemContainerUri };
      });
      batch = await Promise.all(trashed.map(({ file, trash }) => measureRestore(base, webId, file, trash)));
    } else {
      batch = await Promise.all(prepared.map((file) => measureRead(base, file)));
    }
    samples.push(...batch);
    await mapPool(prepared, Math.min(8, prepared.length), (file) => purgeContainer(base, file.storageRoot).catch(() => undefined));
  }

  const summary = stats(samples.map((sample) => sample.latencyMs));
  return {
    method, sizeKb, trashSize, concurrency,
    meanMs: summary.mean, stddevMs: summary.stddev, p50: summary.p50, p95: summary.p95, p99: summary.p99,
    meanRequests: meanOf(samples.map((sample) => sample.requests)),
    meanKbReceived: meanOf(samples.map((sample) => sample.bytesReceived)) / 1024,
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| method | size KB | trash | C | mean ms | SD | p50 | p95 | p99 | reqs | KB recv |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.method} | ${row.sizeKb} | ${row.trashSize} | ${row.concurrency} | ${row.meanMs.toFixed(1)} | ${row.stddevMs.toFixed(1)} | ` +
      `${row.p50.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.meanRequests.toFixed(1)} | ${row.meanKbReceived.toFixed(1)} |`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`base URL ${ARGS.baseUrl}`);
  console.log(`methods ${ARGS.methods.join(", ")} sizes(KB) ${ARGS.sizesKb.join(", ")} trash ${ARGS.trashSizes.join(", ")}`);
  console.log(`concurrency ${ARGS.concurrency.join(", ")} repeats ${ARGS.repeats}`);

  const suffix = `re${Date.now().toString(36)}`;
  const session = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server ${session.serverHeader}`);
  console.log(`pod ${session.pod}\n`);

  const rows: Row[] = [];
  for (const method of ARGS.methods) {
    for (const sizeKb of ARGS.sizesKb) {
      for (const trashSize of ARGS.trashSizes) {
        for (const concurrency of ARGS.concurrency) {
          process.stdout.write(`running ${method} size=${sizeKb}KB trash=${trashSize} C=${concurrency} ... `);
          const row = await runCell(session.authFetch, session.pod, session.webId, method, sizeKb, trashSize, concurrency);
          console.log(`mean ${row.meanMs.toFixed(1)} ms`);
          rows.push(row);
        }
      }
    }
  }

  printTable(rows);
  const outPath = writeResults("restore", suffix, { args: ARGS, server: session.serverHeader, pod: session.pod, webId: session.webId, rows });
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
