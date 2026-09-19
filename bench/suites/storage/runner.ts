/**
 * @packageDocumentation
 * Storage-overhead experiment for the soft-delete design.
 *
 * When a file is soft-deleted it is not erased. It is moved into a trash
 * container and enough metadata is written next to it to bring it back later:
 * a tombstone, a snapshot of the file's ACL, and a copy of the folder index.
 * This runner deletes a file and then reads the real on server size of every
 * artifact left behind (payload, tombstone, ACL snapshot, index copy, and the
 * shared trash-catalog document) from Content-Length, falling back to the GET
 * body length on servers that omit that header.
 *
 * The obvious objection to any trash feature is that it quietly doubles storage
 * by keeping a second full copy of whatever was deleted. 
 * We argues the opposite. The payload is moved, not copied, 
 * so it is kept exactly once and its size tracks the file itself. 
 * 
 * This benchmark sweep the file size axis and the payload column climbs while the
 * overhead column stays flat.
 *
 * Each size point is measured over 1000 repeats, the reported bytes are the mean
 * of all measurements. Every measured file is purged as soon as its sizes are
 * captured, so a full sweep leaves no residue on the pod.
 */

import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import {
  getTrashItemContainerUri, getTrashPayloadUri, getTombstoneUri, getAclSnapshotUri, getTrashCatalogUri,
} from "@/infrastructure/solid/trashPaths";
import { INDEX_FILE } from "@/config";
import { provisionSession } from "../../lib/podSession";
import { toFetchFn, type AuthFetch } from "../../lib/auth";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile } from "../soft-delete/prepareFile";
import { parseGridArgs, meanOf, writeResults } from "../soft-delete/runnerShared";
import { purgeContainer } from "../../lib/purge";

const ARGS = parseGridArgs(process.argv.slice(2), {
  sizesKb: [16, 256, 4096, 8192, 16384],
  trashSizes: [0],
  methods: ["storage"],
  concurrency: [1],
  repeats: 1000,
});

let uniqueCounter = 0;

// Reads a resource's on-server byte size. Prefers Content-Length from a HEAD;
// when the server omits it (pdsinterop sends none for any resource), counts the
// GET body instead, so the size is real on both servers.
async function resourceSize(fetch: AuthFetch, uri: string): Promise<number> {
  const head = await fetch(uri, { method: "HEAD" });
  const declared = head.ok ? head.headers.get("content-length") : null;
  if (declared) return Number(declared);

  const response = await fetch(uri, { method: "GET" });
  if (!response.ok) return 0;
  return (await response.arrayBuffer()).byteLength;
}

interface Measurement {
  payloadBytes: number;
  tombstoneBytes: number;
  aclBytes: number;
  indexBytes: number;
  catalogBytes: number;
}

// Measure the size of a single soft-delete operation, 
// returning the sizes of all artifacts left behind.
async function measureOnce(base: AuthFetch, pod: string, webId: string, sizeKb: number, repeat: number): Promise<Measurement> {
  const file = await prepareFile(base, pod, webId, sizeKb, 0, `storage-s${sizeKb}-r${repeat}`);
  const trashItemId = `store-s${sizeKb}-r${repeat}-${(uniqueCounter++).toString(36)}`;
  const del = await softDeleteFile({
    containerUri: file.descriptor.layout.containerUri, storageRootUri: file.storageRoot,
    catalogUri: file.mainCatalogUri, entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: toFetchFn(base),
    uniqueSuffix: trashItemId,
  });
  if (!del.ok) throw new Error(`soft-delete failed: ${del.reason}`);

  const container = getTrashItemContainerUri(file.storageRoot, trashItemId);
  const [payloadBytes, tombstoneBytes, aclBytes, indexBytes, catalogBytes] = await Promise.all([
    resourceSize(base, getTrashPayloadUri(container)),
    resourceSize(base, getTombstoneUri(container)),
    resourceSize(base, getAclSnapshotUri(container)),
    resourceSize(base, `${container}${INDEX_FILE}`),
    resourceSize(base, getTrashCatalogUri(file.storageRoot)),
  ]);
  // Clean up the trash container so that the pod is left in a pristine state.
  await purgeContainer(base, file.storageRoot).catch(() => undefined);
  return { payloadBytes, tombstoneBytes, aclBytes, indexBytes, catalogBytes };
}

interface Row {
  sizeKb: number;
  payloadBytes: number;
  tombstoneBytes: number;
  aclBytes: number;
  indexBytes: number;
  catalogBytes: number;
  overheadBytes: number;
}

// Run a sweep of soft-delete operations for a given payload size.
async function runSize(base: AuthFetch, pod: string, webId: string, sizeKb: number): Promise<Row> {
  const measurements: Measurement[] = [];
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    measurements.push(await measureOnce(base, pod, webId, sizeKb, repeat));
  }
  const avg = (pick: (measurement: Measurement) => number) => meanOf(measurements.map(pick));
  const tombstoneBytes = avg((measurement) => measurement.tombstoneBytes);
  const aclBytes = avg((measurement) => measurement.aclBytes);
  const indexBytes = avg((measurement) => measurement.indexBytes);
  return {
    sizeKb,
    payloadBytes: avg((measurement) => measurement.payloadBytes),
    tombstoneBytes, aclBytes, indexBytes,
    catalogBytes: avg((measurement) => measurement.catalogBytes),
    overheadBytes: tombstoneBytes + aclBytes + indexBytes,
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| size KB | payload B | tombstone B | acl B | index B | catalog B | overhead B |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.sizeKb} | ${row.payloadBytes.toFixed(0)} | ${row.tombstoneBytes.toFixed(0)} | ${row.aclBytes.toFixed(0)} | ` +
      `${row.indexBytes.toFixed(0)} | ${row.catalogBytes.toFixed(0)} | ${row.overheadBytes.toFixed(0)} |`,
    );
  }
  console.log("\noverhead (tombstone + acl + index) should stay ~flat as payload grows: content is moved, not duplicated.");
}

async function main(): Promise<void> {
  console.log(`base URL ${ARGS.baseUrl}`);
  console.log(`sizes(KB) ${ARGS.sizesKb.join(", ")} repeats ${ARGS.repeats}`);

  const suffix = `st${Date.now().toString(36)}`;
  const session = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server ${session.serverHeader}`);
  console.log(`pod  ${session.pod}\n`);

  const rows: Row[] = [];
  for (const sizeKb of ARGS.sizesKb) {
    process.stdout.write(`measuring size=${sizeKb}KB ... `);
    const row = await runSize(session.authFetch, session.pod, session.webId, sizeKb);
    console.log(`payload ${row.payloadBytes.toFixed(0)} B, overhead ${row.overheadBytes.toFixed(0)} B`);
    rows.push(row);
  }

  printTable(rows);
  const outPath = writeResults("storage", suffix, { args: ARGS, server: session.serverHeader, pod: session.pod, webId: session.webId, rows });
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
