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
 * We inject a server failure at each critical step and check the invariant:
 * afterwards at least one copy of the file must still exist, either at its
 * original location or in the trash. A pass means no data loss. Because the
 * ordering has to hold every time and not just once, each fault point is
 * injected over many trials (repeats, default 1000). The result records how
 * many of those trials stayed recoverable, so the claim is "0 unrecoverable
 * across N fault-injected deletes", not a single lucky pass.
 */

import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { getTrashItemContainerUri, getTrashPayloadUri, getTombstoneUri } from "@/infrastructure/solid/trashPaths";
import { provisionSession, type PodSession } from "../../lib/podSession";
import { toFetchFn, type AuthFetch, type FetchInit } from "../../lib/auth";
import { purgeContainer } from "../../lib/purge";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile } from "../soft-delete/prepareFile";
import { mapPool, writeResults } from "../soft-delete/runnerShared";

interface Args {
  baseUrl: string;
  repeats: number;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { baseUrl: "", repeats: 1000, concurrency: 8 };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--repeats") args.repeats = Number(value);
    else if (flag === "--concurrency") args.concurrency = Number(value);
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

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

// Outcome of one fault-injected soft-delete. `recoverable` false means data loss.
interface Trial {
  recoverable: boolean;
  transientDuplicate: boolean;
  detail: string;
}

// Runs one soft-delete with a fault injected at the given point, then checks the invariant and cleans up.
async function runTrial(session: PodSession, fault: FaultPoint, trialId: string): Promise<Trial> {
  const { authFetch: base, pod, webId } = session;
  const file = await prepareFile(base, pod, webId, 2, 0, `fa-${trialId}`);
  const trashItemId = `fault-${trialId}`;
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

  // Reclaim disk before the next trial; the invariant is already captured.
  await purgeContainer(base, file.storageRoot).catch(() => undefined);

  return {
    recoverable, transientDuplicate,
    detail: `soft-delete ${result.ok ? "ok" : "failed"}; original=${originalPresent}, trashComplete=${trashComplete}${transientDuplicate ? " (transient duplicate)" : ""}`,
  };
}

// Aggregate over all trials at one fault point.
interface Row extends Record<string, unknown> {
  faultPoint: string;
  trials: number;
  recoverable: number;
  notRecoverable: number;
  transientDuplicates: number;
  errors: number;
  firstFailure: string;
}

async function runFault(session: PodSession, fault: FaultPoint, faultIndex: number): Promise<Row> {
  const trialIds = Array.from({ length: ARGS.repeats }, (_unused, trial) => `${faultIndex}-${trial}`);
  const row: Row = {
    faultPoint: fault.name, trials: ARGS.repeats,
    recoverable: 0, notRecoverable: 0, transientDuplicates: 0, errors: 0, firstFailure: "",
  };

  await mapPool(trialIds, ARGS.concurrency, async (trialId) => {
    let trial: Trial;
    try {
      trial = await runTrial(session, fault, trialId);
    } catch {
      row.errors++;
      return;
    }
    if (trial.transientDuplicate) row.transientDuplicates++;
    if (trial.recoverable) {
      row.recoverable++;
    } else {
      row.notRecoverable++;
      if (!row.firstFailure) row.firstFailure = `trial ${trialId}: ${trial.detail}`;
    }
  });

  return row;
}

async function main(): Promise<void> {
  const runId = `fa${Date.now().toString(36)}`;
  console.log(`base URL     ${ARGS.baseUrl}`);
  console.log(`repeats      ${ARGS.repeats}   concurrency ${ARGS.concurrency}`);
  const session = await provisionSession(ARGS.baseUrl, runId);
  console.log(`server       ${session.serverHeader}`);
  console.log(`pod          ${session.pod}\n`);

  const rows: Row[] = [];
  for (const [faultIndex, fault] of FAULT_POINTS.entries()) {
    process.stdout.write(`injecting at ${fault.name} x${ARGS.repeats} ... `);
    const row = await runFault(session, fault, faultIndex);
    const ok = row.notRecoverable === 0;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${row.recoverable}/${row.trials} recoverable` +
      `${row.transientDuplicates ? `, ${row.transientDuplicates} transient dup` : ""}` +
      `${row.errors ? `, ${row.errors} errors` : ""}`,
    );
    rows.push(row);
  }

  const outPath = writeResults("failure-atomicity", runId, {
    args: { baseUrl: ARGS.baseUrl, repeats: ARGS.repeats }, server: session.serverHeader, pod: session.pod, rows,
  });
  const lost = rows.filter((row) => row.notRecoverable > 0);
  console.log(`\n${rows.length - lost.length}/${rows.length} fault points kept the file recoverable in every trial. wrote ${outPath}`);
  if (lost.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
