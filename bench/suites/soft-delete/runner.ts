/**
 * @packageDocumentation
 * Measures how long it takes to soft-delete a file:
 * the results are meant to compare the soft-delete process 
 * against a standard HTTP delete on a live Solid server.
 * 
 * This runs the comparison across a range of file sizes, trash sizes, and
 * concurrency levels, recording latency and the requests and bytes each
 * delete takes.
 */

import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { deleteResource } from "@/features/file-explorer/services/deleteResource";
import { provisionSession } from "../../lib/podSession";
import { instrumentFetch } from "../../lib/instrumentedFetch";
import { stats } from "../../lib/stats";
import { toFetchFn, type AuthFetch } from "../../lib/auth";
import { sharedEntry } from "./fileFixture";
import { prepareFile, type PreparedFile } from "./prepareFile";
import { mapPool, parseGridArgs, meanOf, writeResults, type Sample } from "./runnerShared";
import { purgeContainer } from "../../lib/purge";

const ARGS = parseGridArgs(process.argv.slice(2), {
  sizesKb: [16,256,4096,8192,16384],
  trashSizes: [0, 64, 512],
  methods: ["soft", "hard"],
  concurrency: [1],
  repeats: 1000,
});

// Measures one soft or hard delete.
async function measureDelete(authFetch: AuthFetch, webId: string, method: string, prepared: PreparedFile): Promise<Sample> {
  const { descriptor, storageRoot, mainCatalogUri } = prepared;
  const { fetch: metered, metrics } = instrumentFetch(authFetch);

  const start = performance.now();
  if (method === "soft") {
    const result = await softDeleteFile({
      containerUri: descriptor.layout.containerUri, storageRootUri: storageRoot,
      catalogUri: mainCatalogUri, entry: sharedEntry(descriptor), ownerWebId: webId, fetch: toFetchFn(metered),
    });
    if (!result.ok) throw new Error(`soft-delete failed: ${result.reason}`);
  } else {
    const result = await deleteResource({
      containerUri: descriptor.layout.containerUri, catalogUri: mainCatalogUri,
      metadataUri: descriptor.layout.indexUri, fetch: toFetchFn(metered),
    });
    if (!result.ok) throw new Error(`hard-delete failed: ${result.reason}`);
  }
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
  meanKbSent: number;
  meanKbReceived: number;
}

// Runs one benchmark cell for a method, file size, trash size, and concurrency level.
async function runCell(base: AuthFetch, pod: string, webId: string, method: string, sizeKb: number, trashSize: number, concurrency: number): Promise<Row> {
  const samples: Sample[] = [];
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    const tag = `${method}-s${sizeKb}-t${trashSize}-c${concurrency}-r${repeat}`;
    const workers = Array.from({ length: concurrency }, (_unused, worker) => worker);
    const prepared = await mapPool(workers, Math.min(8, concurrency), () =>
      prepareFile(base, pod, webId, sizeKb, trashSize, tag),
    );
    const batch = await Promise.all(prepared.map((file) => measureDelete(base, webId, method, file)));
    samples.push(...batch);
    await mapPool(prepared, Math.min(8, prepared.length), (file) => purgeContainer(base, file.storageRoot).catch(() => undefined));
  }

  const summary = stats(samples.map((sample) => sample.latencyMs));
  return {
    method, sizeKb, trashSize, concurrency,
    meanMs: summary.mean, stddevMs: summary.stddev, p50: summary.p50, p95: summary.p95, p99: summary.p99,
    meanRequests: meanOf(samples.map((sample) => sample.requests)),
    meanKbSent: meanOf(samples.map((sample) => sample.bytesSent)) / 1024,
    meanKbReceived: meanOf(samples.map((sample) => sample.bytesReceived)) / 1024,
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| method | size KB | trash | C | mean ms | SD | p50 | p95 | p99 | reqs | KB sent | KB recv |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.method} | ${row.sizeKb} | ${row.trashSize} | ${row.concurrency} | ${row.meanMs.toFixed(1)} | ${row.stddevMs.toFixed(1)} | ` +
      `${row.p50.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.meanRequests.toFixed(1)} | ` +
      `${row.meanKbSent.toFixed(1)} | ${row.meanKbReceived.toFixed(1)} |`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`base URL ${ARGS.baseUrl}`);
  console.log(`methods ${ARGS.methods.join(", ")} sizes(KB) ${ARGS.sizesKb.join(", ")} trash ${ARGS.trashSizes.join(", ")}`);
  console.log(`concurrency ${ARGS.concurrency.join(", ")} repeats ${ARGS.repeats}`);

  const suffix = `sd${Date.now().toString(36)}`;
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
          console.log(`mean ${row.meanMs.toFixed(1)} ms, ${row.meanRequests.toFixed(1)} reqs`);
          rows.push(row);
        }
      }
    }
  }

  printTable(rows);
  const outPath = writeResults("soft-delete", suffix, { args: ARGS, server: session.serverHeader, pod: session.pod, webId: session.webId, rows });
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
