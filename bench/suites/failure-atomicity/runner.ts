/**
 * @packageDocumentation
 * Tests failure atomicity of the soft-delete process:
 * 
 * A soft delete in Solid cannot be performed as a single atomic operation. 
 * Since HTTP standard protocol provides no transaction or MOVE;
 * this is a gap the thesis tracks as open problem A1
 * (Section 4.3, "The soft-delete process in standard HTTP").
 * 
 * therefore a soft-delete process must be a sequence of separate HTTP requests:
 * 1. Copy the original file to a trash location (payload + tombstone + ACL)
 * 2. Delete the original file
 *  
 * We write the trash copy before touching the original,
 * so should the transaction fail at any given step, the file remains recoverable.
 *
 * This is a smoke test suite to check that the write-before-delete ordering holds
 * under failure. we inject a server failure at each critical step and check the invariant: after
 * at least one copy of the file must exist, either at its original location 
 * or in the trash. A pass means no data loss.
 */

import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { getTrashItemContainerUri, getTrashPayloadUri, getTombstoneUri } from "@/infrastructure/solid/trashPaths";
import { provisionSession, type PodSession } from "../../lib/podSession";
import { toFetchFn, type AuthFetch, type FetchInit } from "../../lib/auth";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile } from "../soft-delete/prepareFile";
import { writeResults } from "../soft-delete/runnerShared";

function parseBaseUrl(argv: string[]): string {
  const flagIndex = argv.indexOf("--base-url");
  const value = flagIndex >= 0 ? argv[flagIndex + 1] : "";
  if (!value) throw new Error("--base-url is required");
  return value.endsWith("/") ? value : `${value}/`;
}

const BASE_URL = parseBaseUrl(process.argv.slice(2));

type FailPredicate = (method: string, url: string) => boolean;

// Injects a failure into the fetch function, returning a 500 response for failed requests.
function faultyFetch(inner: AuthFetch, shouldFail: FailPredicate): AuthFetch {
  return async (url: string, init: FetchInit = {}) => {
    if (shouldFail(init.method ?? "GET", url)) {
      return new Response("injected failure", { status: 500, statusText: "Injected" });
    }
    return inner(url, init);
  };
}

// Checks whether a resource exists by sending a HEAD request.
async function isPresent(fetch: AuthFetch, uri: string): Promise<boolean> {
  const response = await fetch(uri, { method: "HEAD" });
  return response.ok;
}

interface FaultPoint {
  name: string;
  shouldFail: FailPredicate;
}

// The fault points are chosen to cover the critical steps of the soft-delete
const FAULT_POINTS: FaultPoint[] = [
  { name: "trash payload copy", shouldFail: (method, url) => method === "PUT" && url.includes("/trash/") && url.endsWith("/payload") },
  { name: "tombstone write", shouldFail: (method, url) => method === "PUT" && url.endsWith("tombstone.ttl") },
  { name: "original delete", shouldFail: (method, url) => method === "DELETE" && url.includes("/files/") && !url.includes("/trash/") },
];

interface Check {
  faultPoint: string;
  recoverable: boolean;
  originalPresent: boolean;
  trashComplete: boolean;
  transientDuplicate: boolean;
  detail: string;
}

// Runs a soft-delete with a fault injected at the given point, returning a check of the invariant.
async function runFault(session: PodSession, fault: FaultPoint, index: number): Promise<Check> {
  const { authFetch: base, pod, webId } = session;
  const file = await prepareFile(base, pod, webId, 2, 0, `fa-${index}`);
  const trashItemId = `fault-${index}`;
  const injected = faultyFetch(base, fault.shouldFail);

  const result = await softDeleteFile({
    containerUri: file.descriptor.layout.containerUri, storageRootUri: file.storageRoot,
    catalogUri: file.mainCatalogUri, entry: sharedEntry(file.descriptor), ownerWebId: webId,
    fetch: toFetchFn(injected), uniqueSuffix: trashItemId,
  }).catch((error) => ({ ok: false as const, reason: error instanceof Error ? error.message : "threw" }));

  const container = getTrashItemContainerUri(file.storageRoot, trashItemId);
  const [originalPresent, trashPayload, tombstone] = await Promise.all([
    isPresent(base, file.descriptor.layout.binaryUri),
    isPresent(base, getTrashPayloadUri(container)),
    isPresent(base, getTombstoneUri(container)),
  ]);

  const trashComplete = trashPayload && tombstone;
  const recoverable = originalPresent || trashComplete;
  const transientDuplicate = originalPresent && trashComplete;
  return {
    faultPoint: fault.name,
    recoverable, originalPresent, trashComplete, transientDuplicate,
    detail: `soft-delete ${result.ok ? "ok" : "failed"}; original=${originalPresent}, trashComplete=${trashComplete}${transientDuplicate ? " (transient duplicate)" : ""}`,
  };
}

// Runs the test for every fault point and fails if any of them is not recoverable.
async function main(): Promise<void> {
  const runId = `fa${Date.now().toString(36)}`;
  console.log(`base URL     ${BASE_URL}`);
  const session = await provisionSession(BASE_URL, runId);
  console.log(`server       ${session.serverHeader}`);
  console.log(`pod          ${session.pod}\n`);

  const checks: Check[] = [];
  for (const [index, fault] of FAULT_POINTS.entries()) {
    const check = await runFault(session, fault, index);
    console.log(`${check.recoverable ? "PASS" : "FAIL"}  fault: ${check.faultPoint} — ${check.detail}`);
    checks.push(check);
  }

  const outPath = writeResults("failure-atomicity", runId, { baseUrl: BASE_URL, server: session.serverHeader, checks });
  const failed = checks.filter((check) => !check.recoverable);
  console.log(`\n${checks.length - failed.length}/${checks.length} recoverable. wrote ${outPath}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
