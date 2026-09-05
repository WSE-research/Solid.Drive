/**
 * @packageDocumentation
 * Checks the three promises soft delete has to keep, running the shipped
 * services against a live Solid server:
 *
 *   1. A restored file comes back byte-for-byte identical to the original.
 *   2. Restoring onto a name that has since been reused is refused, so a delete
 *      can never overwrite a newer file.
 *   3. Once an item is purged, it cannot be restored.
 *
 * The first two are the thesis requirements FR4 (faithful restore) and NFR1 (no
 * resurrection); the third is the purge guarantee.
 *
 * This runs next to the Playwright UI test, not in place of it.
 */

import type { FetchFn } from "@/types/solid";
import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { restoreTrashedFile } from "@/features/file-explorer/services/restoreTrashedFile";
import { deleteResource } from "@/features/file-explorer/services/deleteResource";
import { provisionSession, type PodSession } from "../../lib/podSession";
import { toFetchFn } from "../../lib/auth";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile, MEDIA_TYPE, type PreparedFile } from "../soft-delete/prepareFile";
import { writeResults } from "../soft-delete/runnerShared";

function parseBaseUrl(argv: string[]): string {
  const flagIndex = argv.indexOf("--base-url");
  const value = flagIndex >= 0 ? argv[flagIndex + 1] : "";
  if (!value) throw new Error("--base-url is required");
  return value.endsWith("/") ? value : `${value}/`;
}

const BASE_URL = parseBaseUrl(process.argv.slice(2));

// A deterministic byte pattern, distinct from real file content, so a
// restored file's bytes can later be checked against it.
function markedPayload(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index++) bytes[index] = (index * 31 + 7) % 256;
  return bytes;
}

// Compares two byte arrays for length and content equality.
function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

// Creates a pod file whose payload is a marker pattern, returning both the
// file and the payload so a later check can compare against it.
async function prepareMarkedFile(session: PodSession, tag: string) {
  const { authFetch: base, pod, webId } = session;
  const payload = markedPayload(2048);
  const file = await prepareFile(base, pod, webId, 2, 0, tag);
  await base(file.descriptor.layout.binaryUri, { method: "PUT", headers: { "content-type": MEDIA_TYPE }, body: payload });
  return { file, payload };
}

// Soft-deletes a prepared file with the args every check shares.
function softDeleteMarked(file: PreparedFile, webId: string, appFetch: FetchFn) {
  return softDeleteFile({
    containerUri: file.descriptor.layout.containerUri, storageRootUri: file.storageRoot,
    catalogUri: file.mainCatalogUri, entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: appFetch,
  });
}

// Restores a trashed file with the args every check shares.
function restoreMarked(file: PreparedFile, trashItemContainerUri: string, webId: string, appFetch: FetchFn) {
  return restoreTrashedFile({
    trashItemContainerUri, storageRootUri: file.storageRoot,
    entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: appFetch,
  });
}

async function checkFaithfulRestore(session: PodSession): Promise<Check> {
  const { authFetch: base, webId } = session;
  const { file, payload } = await prepareMarkedFile(session, "fr4");
  const appFetch = toFetchFn(base);
  const del = await softDeleteMarked(file, webId, appFetch);
  if (!del.ok) return { name: "FR4 faithful restore", ok: false, detail: `soft-delete failed: ${del.reason}` };

  const restored = await restoreMarked(file, del.trashItemContainerUri, webId, appFetch);
  if (!restored.ok) return { name: "FR4 faithful restore", ok: false, detail: `restore failed: ${restored.reason}` };

  const response = await base(file.descriptor.layout.binaryUri, { method: "GET" });
  if (!response.ok) return { name: "FR4 faithful restore", ok: false, detail: `restored binary GET ${response.status}` };
  const restoredBytes = new Uint8Array(await response.arrayBuffer());
  const identical = bytesEqual(restoredBytes, payload);
  return { name: "FR4 faithful restore", ok: identical, detail: identical ? "restored payload byte-identical" : `byte mismatch (${restoredBytes.byteLength} vs ${payload.byteLength})` };
}

async function checkNoResurrection(session: PodSession): Promise<Check> {
  const { authFetch: base, webId } = session;
  const { file } = await prepareMarkedFile(session, "nfr1");
  const appFetch = toFetchFn(base);
  const del = await softDeleteMarked(file, webId, appFetch);
  if (!del.ok) return { name: "NFR1 no resurrection", ok: false, detail: `soft-delete failed: ${del.reason}` };

  // Re-occupy the original location before restoring.
  await base(file.descriptor.layout.binaryUri, { method: "PUT", headers: { "content-type": MEDIA_TYPE }, body: markedPayload(512) });
  await base(file.descriptor.layout.indexUri, { method: "PUT", headers: { "content-type": "text/turtle" }, body: "@prefix schema: <https://schema.org/> .\n<> schema:name \"occupier\" ." });

  const restored = await restoreMarked(file, del.trashItemContainerUri, webId, appFetch);
  const refused = !restored.ok && restored.reason === "occupied";
  return { name: "NFR1 no resurrection", ok: refused, detail: refused ? "restore correctly refused (occupied)" : `expected occupied, got ${restored.ok ? "ok" : restored.reason}` };
}

async function checkPurgeIrreversible(session: PodSession): Promise<Check> {
  const { webId } = session;
  const { file } = await prepareMarkedFile(session, "purge");
  const appFetch = toFetchFn(session.authFetch);
  const del = await softDeleteMarked(file, webId, appFetch);
  if (!del.ok) return { name: "Purge irreversibility", ok: false, detail: `soft-delete failed: ${del.reason}` };

  const purged = await deleteResource({ containerUri: del.trashItemContainerUri, fetch: appFetch });
  if (!purged.ok) return { name: "Purge irreversibility", ok: false, detail: `purge failed: ${purged.reason}` };

  const restored = await restoreMarked(file, del.trashItemContainerUri, webId, appFetch);
  const blocked = !restored.ok;
  return { name: "Purge irreversibility", ok: blocked, detail: blocked ? `restore blocked (${restored.reason})` : "restore unexpectedly succeeded after purge" };
}

async function main(): Promise<void> {
  const runId = `co${Date.now().toString(36)}`;
  console.log(`base URL     ${BASE_URL}`);
  const session = await provisionSession(BASE_URL, runId);
  console.log(`server       ${session.serverHeader}`);
  console.log(`pod          ${session.pod}\n`);

  const checks: Check[] = [];
  for (const check of [checkFaithfulRestore, checkNoResurrection, checkPurgeIrreversible]) {
    const result = await check(session);
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name} — ${result.detail}`);
    checks.push(result);
  }

  const outPath = writeResults("correctness", runId, { baseUrl: BASE_URL, server: session.serverHeader, checks });
  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed. wrote ${outPath}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
