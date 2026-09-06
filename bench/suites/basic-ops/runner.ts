/**
 * @packageDocumentation
 * Measures the basic HTTP operations used by the evaluated Solid processes:
 * GET, PUT, PATCH, and DELETE, including a comparison between binary and ACL
 * deletion.
 *
 * This is the "Basic Analysis" of the runtime chapter: 
 * before the composed end-to-end processes we wnated to establish that every underlying operation behaves as
 * expected on their own, so any anomaly seen later in a process can be attributed
 * to the process rather than to a base operation. 
 * 
 * Each iteration measures a single operation;
 * the setup and cleanup around it (creating the target and removing it afterwards) 
 * use the raw session fetch and are NOT counted.
 *
 * For each operation and file size, the benchmark reports mean latency,
 * sample standard deviation, p50/p95/p99, mean request count, and
 * transferred bytes. (via {@link instrumentFetch}) 
 * that explain why an operation costs what it does.
 *
 * GET, PUT, and DELETE are measured across all configured file sizes.
 * PATCH and ACL deletion do not transfer a file payload and are therefore
 * measured only at the smallest configured size.
 * 
 * sizes-kb: 16,256,4096 
 * --repeats 1000
 */

import { provisionSession, type PodSession } from "../../lib/podSession";
import { instrumentFetch, type InstrumentedFetch } from "../../lib/instrumentedFetch";
import type { AuthFetch } from "../../lib/auth";
import { stats } from "../../lib/stats";
import { parseGridArgs, meanOf, writeResults, type Sample } from "../soft-delete/runnerShared";

const ARGS = parseGridArgs(process.argv.slice(2), {
  sizesKb: [1, 16, 256, 4096],
  trashSizes: [0],
  methods: ["basic"],
  concurrency: [1],
  repeats: 3,
});

/** Base operations, in the order of their presentation in the chapter. */
const OPS = ["get", "put", "patch", "delete", "acl-delete"] as const;
type Op = (typeof OPS)[number];

// Operations whose cost scales with the file payload. 
const SIZE_DEPENDENT = new Set<Op>(["get", "put", "delete"]);

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";

let uniqueCounter = 0;

const payloadCache = new Map<number, Uint8Array>();

function payloadFor(sizeKb: number): Uint8Array {
  let payload = payloadCache.get(sizeKb);
  if (!payload) {
    payload = new Uint8Array(sizeKb * 1024).fill(0x61);
    payloadCache.set(sizeKb, payload);
  }
  return payload;
}

/** A One triple N3 insert patch: 
 * which is the smallest meaningful PATCH the server accepts. */
function insertPatch(tag: string): string {
  return `@prefix solid: <http://www.w3.org/ns/solid/terms#> .
_:patch a solid:InsertDeletePatch ;
  solid:inserts { <#it> <${RDFS_COMMENT}> "ins-${tag}" . } .
`;
}

/** A minimal, valid WAC ACL document granting the owner full control. */
function ownerAcl(resourceUri: string, webId: string): string {
  const agent = webId
    ? `acl:agent <${webId}>`
    : "acl:agentClass foaf:Agent";
  return `@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
<#owner> a acl:Authorization ;
  ${agent} ;
  acl:accessTo <${resourceUri}> ;
  acl:mode acl:Read, acl:Write, acl:Control .
`;
}

async function putOrThrow(fetch: AuthFetch, uri: string, contentType: string, body: string | Uint8Array): Promise<void> {
  const response = await fetch(uri, { method: "PUT", headers: { "content-type": contentType }, body });
  if (!response.ok) throw new Error(`setup PUT ${uri} -> ${response.status}`);
}

/** Deletes a resource, ignoring failure: cleanup must never fail a measurement. */
async function cleanup(fetch: AuthFetch, uri: string): Promise<void> {
  await fetch(uri, { method: "DELETE" }).catch(() => undefined);
}

/**
 * Measures one HTTP operation independently.
 * Setup and cleanup are excluded, so the recorded latency, request count,
 * and transferred bytes only cover the operation being measured.
 */
async function measureOnce(session: PodSession, inst: InstrumentedFetch, op: Op, sizeKb: number, tag: string): Promise<Sample> {
  const { pod, authFetch } = session;
  const base = `${pod}basic-ops`;

  const timed = async (call: () => Promise<Response>, label: string): Promise<Sample> => {
    inst.reset();
    const start = performance.now();
    const response = await call();
    const latencyMs = performance.now() - start;
    if (!response.ok) throw new Error(`${label} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
    return { latencyMs, ...inst.metrics };
  };

  switch (op) {
    case "put": {
      const uri = `${base}/put-${tag}`;
      const sample = await timed(() => inst.fetch(uri, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: payloadFor(sizeKb) }), `PUT ${uri}`);
      await cleanup(authFetch, uri);
      return sample;
    }
    case "get": {
      const uri = `${base}/get-${tag}`;
      await putOrThrow(authFetch, uri, "application/octet-stream", payloadFor(sizeKb));
      inst.reset();
      const start = performance.now();
      const response = await inst.fetch(uri, { method: "GET" });
      if (!response.ok) throw new Error(`GET ${uri} -> ${response.status}`);
      await response.arrayBuffer();
      const sample: Sample = { latencyMs: performance.now() - start, ...inst.metrics };
      await cleanup(authFetch, uri);
      return sample;
    }
    case "delete": {
      const uri = `${base}/del-${tag}`;
      await putOrThrow(authFetch, uri, "application/octet-stream", payloadFor(sizeKb));
      return timed(() => inst.fetch(uri, { method: "DELETE" }), `DELETE ${uri}`);
    }
    case "patch": {
      const uri = `${base}/patch-${tag}.ttl`;
      await putOrThrow(authFetch, uri, "text/turtle", `<#it> <${RDFS_LABEL}> "seed" .`);
      const sample = await timed(() => inst.fetch(uri, { method: "PATCH", headers: { "content-type": "text/n3" }, body: insertPatch(tag) }), `PATCH ${uri}`);
      await cleanup(authFetch, uri);
      return sample;
    }
    case "acl-delete": {
      const resourceUri = `${base}/acl-${tag}.ttl`;
      const aclUri = `${resourceUri}.acl`;
      await putOrThrow(authFetch, resourceUri, "text/turtle", `<#it> <${RDFS_LABEL}> "acl target" .`);
      await putOrThrow(authFetch, aclUri, "text/turtle", ownerAcl(resourceUri, session.webId));
      const sample = await timed(() => inst.fetch(aclUri, { method: "DELETE" }), `DELETE ${aclUri}`);
      await cleanup(authFetch, resourceUri);
      return sample;
    }
  }
}

interface Row {
  op: Op;
  sizeKb: number;
  count: number;
  meanMs: number;
  stddev: number;
  p50: number;
  p95: number;
  p99: number;
  meanRequests: number;
  meanBytesSent: number;
  meanBytesReceived: number;
}

async function runCell(session: PodSession, inst: InstrumentedFetch, op: Op, sizeKb: number): Promise<Row> {
  const samples: Sample[] = [];
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    const tag = `${op}-s${sizeKb}-r${repeat}-${(uniqueCounter++).toString(36)}`;
    samples.push(await measureOnce(session, inst, op, sizeKb, tag));
  }
  const summary = stats(samples.map((sample) => sample.latencyMs));
  return {
    op, sizeKb,
    count: summary.count, meanMs: summary.mean, stddev: summary.stddev,
    p50: summary.p50, p95: summary.p95, p99: summary.p99,
    meanRequests: meanOf(samples.map((sample) => sample.requests)),
    meanBytesSent: meanOf(samples.map((sample) => sample.bytesSent)),
    meanBytesReceived: meanOf(samples.map((sample) => sample.bytesReceived)),
  };
}

function printTable(rows: Row[]): void {
  console.log("\n| op | size KB | n | mean ms | SD | p50 | p95 | p99 | reqs | KB sent | KB recv |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.op} | ${row.sizeKb} | ${row.count} | ${row.meanMs.toFixed(1)} | ${row.stddev.toFixed(1)} | ` +
      `${row.p50.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.meanRequests.toFixed(1)} | ` +
      `${(row.meanBytesSent / 1024).toFixed(1)} | ${(row.meanBytesReceived / 1024).toFixed(1)} |`,
    );
  }
  console.log("\npatch and acl-delete carry no file payload, so they run once at the smallest size.");
  console.log("acl-delete vs delete at the same size shows deleting an ACL costs the same as deleting a binary.");
}

async function main(): Promise<void> {
  console.log(`base URL     ${ARGS.baseUrl}`);
  console.log(`ops          ${OPS.join(", ")}`);
  console.log(`sizes(KB)    ${ARGS.sizesKb.join(", ")}   repeats ${ARGS.repeats}`);

  const suffix = `bo${Date.now().toString(36)}`;
  const session = await provisionSession(ARGS.baseUrl, suffix);
  const inst = instrumentFetch(session.authFetch);
  console.log(`server       ${session.serverHeader}`);
  console.log(`pod          ${session.pod}\n`);

  const rows: Row[] = [];
  for (const op of OPS) {
    const sizes = SIZE_DEPENDENT.has(op) ? ARGS.sizesKb : [ARGS.sizesKb[0]];
    for (const sizeKb of sizes) {
      process.stdout.write(`running ${op} size=${sizeKb}KB ... `);
      const row = await runCell(session, inst, op, sizeKb);
      console.log(`mean ${row.meanMs.toFixed(1)} ms, SD ${row.stddev.toFixed(1)} ms`);
      rows.push(row);
    }
  }

  printTable(rows);
  const outPath = writeResults("basic-ops", suffix, { args: ARGS, server: session.serverHeader, pod: session.pod, webId: session.webId, rows });
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
