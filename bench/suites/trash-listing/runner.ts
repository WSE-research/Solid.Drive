/**
 * @packageDocumentation
 * Trash-listing scalability experiment.
 *
 * Opening the Recycle Bin is not a single read. The trash entries hook fetches
 * the trash catalog, parses it into one entry per deleted item, and then reads
 * that item's tombstone to recover its original name and location.
 * every iteams detail lives in its tombstones, so a full listing costs
 * one catalog GET plus one tombstone read per item. This
 * runner reproduces that exact request pattern against a real pod and times it as
 * the trash fills.
 *
 * Soft-delete is only useful if the bin stays usable once it holds real content. 
 * Keeping each deleted item's metadata separate buys simplicity and isolation, 
 * and the honest question is what that costs at the listing step. 
 * So the request count grows with the number of trashed items (1 + N).
 */

import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { parseCatalog } from "@/infrastructure/solid/catalog";
import { readTombstone } from "@/infrastructure/solid/tombstone";
import { getTombstoneUri, getTrashCatalogUri } from "@/infrastructure/solid/trashPaths";
import { INDEX_FILE } from "@/config";
import { provisionSession } from "../../lib/podSession";
import { instrumentFetch } from "../../lib/instrumentedFetch";
import { stats } from "../../lib/stats";
import { toFetchFn, type AuthFetch } from "../../lib/auth";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile } from "../soft-delete/prepareFile";
import { meanOf, writeResults } from "../soft-delete/runnerShared";

interface Args {
  baseUrl: string;
  itemCounts: number[];
  repeats: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { baseUrl: "", itemCounts: [5, 20, 50, 100], repeats: 1000 };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--item-counts") args.itemCounts = value.split(",").map(Number);
    else if (flag === "--repeats") args.repeats = Number(value);
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));
let rootCounter = 0;

interface ListResult {
  latencyMs: number;
  requests: number;
  items: number;
}

// List the trash using trash catalog entries: 
// GET the catalog, then read one tombstone per entry. 
// Returns latency and the request count. 
async function listTrash(authFetch: AuthFetch, trashCatalogUri: string): Promise<ListResult> {
  const { fetch: metered, metrics } = instrumentFetch(authFetch);
  const start = performance.now();
  const response = await metered(trashCatalogUri);
  const turtle = response.ok ? await response.text() : "";
  const entries = parseCatalog(turtle, trashCatalogUri);
  await Promise.all(entries.map((entry) => {
    const containerUri = entry.uri.endsWith(INDEX_FILE) ? entry.uri.slice(0, -INDEX_FILE.length) : entry.uri;
    return readTombstone(getTombstoneUri(containerUri), toFetchFn(metered));
  }));
  return { latencyMs: performance.now() - start, requests: metrics.requests, items: entries.length };
}

// Sequentially soft-deletes `count` files into one shared root, so they all land in a single trash catalog.
async function seedTrash(base: AuthFetch, pod: string, webId: string, root: string, count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    const file = await prepareFile(base, pod, webId, 16, 0, `tl-c${count}`, root);
    const del = await softDeleteFile({
      containerUri: file.descriptor.layout.containerUri, storageRootUri: root,
      catalogUri: file.mainCatalogUri, entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: toFetchFn(base),
    });
    if (!del.ok) throw new Error(`seed soft-delete failed: ${del.reason}`);
  }
}

interface Row {
  itemCount: number;
  items: number;
  meanMs: number;
  p50: number;
  p95: number;
  p99: number;
  meanRequests: number;
  samples: number[];
}


// One data point: 
// seed `count` items into a fresh root, 
// list that trash `ARGS.repeats` times, 
// and return the latency summary plus mean request count. 
// The fresh root keeps each count's trash catalog separate.
async function runCount(base: AuthFetch, pod: string, webId: string, count: number): Promise<Row> {
  const root = `${pod}tl${rootCounter++}/`;
  await seedTrash(base, pod, webId, root, count);

  const trashCatalogUri = getTrashCatalogUri(root);
  const samples: ListResult[] = [];
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    samples.push(await listTrash(base, trashCatalogUri));
  }
  const summary = stats(samples.map((sample) => sample.latencyMs));
  return {
    itemCount: count, items: samples[0].items,
    meanMs: summary.mean, p50: summary.p50, p95: summary.p95, p99: summary.p99,
    meanRequests: meanOf(samples.map((sample) => sample.requests)),
    samples: samples.map((sample) => sample.latencyMs),
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| trashed items | listed | mean ms | p50 | p95 | p99 | requests |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.itemCount} | ${row.items} | ${row.meanMs.toFixed(1)} | ${row.p50.toFixed(1)} | ` +
      `${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.meanRequests.toFixed(0)} |`,
    );
  }
  console.log("\nEach listing is 1 catalog read plus one tombstone per item, so requests scale linearly with trash size: O(items).");
}

async function main(): Promise<void> {
  console.log(`base URL ${ARGS.baseUrl}`);
  console.log(`item counts ${ARGS.itemCounts.join(", ")} repeats ${ARGS.repeats}`);

  const suffix = `tl${Date.now().toString(36)}`;
  const session = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server ${session.serverHeader}`);
  console.log(`pod ${session.pod}\n`);

  const rows: Row[] = [];
  for (const count of ARGS.itemCounts) {
    process.stdout.write(`seeding + listing ${count} items ... `);
    const row = await runCount(session.authFetch, session.pod, session.webId, count);
    console.log(`${row.items} listed, mean ${row.meanMs.toFixed(1)} ms`);
    rows.push(row);
  }

  printTable(rows);
  const outPath = writeResults("trash-listing", suffix, { args: ARGS, server: session.serverHeader, pod: session.pod, rows });
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
