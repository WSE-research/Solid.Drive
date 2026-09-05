/**
 * @packageDocumentation
 * Load and scaling benchmark for concurrent writes against a live Solid server.
 * This suite sends N concurrent authenticated writes to the same container and
 * reports the response-time distribution and the share of requests that remain
 * unanswered within the configured deadline of 30 s.
 *
 * `levels` represents the concurrency ladder. Each level is the number of
 * concurrent writes sent by the client. The ladder increases until the server
 * reaches saturation.(too many unanswered requests). 
 * 
 * Tested levels: 8,16,24,32,40,48,56,64
 */

import { provisionSession } from "../../lib/podSession";
import { stats } from "../../lib/stats";
import type { AuthFetch } from "../../lib/auth";
import { writeResults } from "../soft-delete/runnerShared";

interface Args {
  baseUrl: string;
  levels: number[];
  deadlineMs: number;
  repeats: number;
  abortPct: number;
}

// Parse a command-line arguments into an Args object. 
function parseArgs(argv: string[]): Args {
  const args: Args = { 
    baseUrl: "", 
    levels: [8,16,24,32,40,48,56,64], 
    deadlineMs: 30000, 
    repeats: 1000, 
    abortPct: 100 
  };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--levels") args.levels = value.split(",").map(Number);
    else if (flag === "--deadline-ms") args.deadlineMs = Number(value);
    else if (flag === "--repeats") args.repeats = Number(value);
    else if (flag === "--abort-pct") args.abortPct = Number(value);
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));
let counter = 0;

// Performs a single client operation: 
// 1- PUT a small file to the pod
// 2- Return the latency in ms or null if the request was unanswered within the deadline.
async function clientOp(authFetch: AuthFetch, pod: string, deadlineMs: number): Promise<number | null> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), deadlineMs); });
  const op = (async () => {
    try {
      const response = await authFetch(`${pod}load/r-${counter++}.txt`, { method: "PUT", headers: { "content-type": "text/plain" }, body: "x" });
      return response.ok;
    } catch {
      return false;
    }
  })();
  const ok = await Promise.race([op, deadline]);
  clearTimeout(timer);
  return ok ? performance.now() - start : null;
}

interface Row {
  level: number;
  successes: number;
  failures: number;
  failurePct: number;
  meanMs: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
}

// Runs a single level of the load test, returning a Row with the results.
async function runLevel(authFetch: AuthFetch, pod: string, level: number): Promise<Row> {
  const latencies: number[] = [];
  let failures = 0;
  const start = performance.now();
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    const outcomes = await Promise.all(Array.from({ length: level }, () => clientOp(authFetch, pod, ARGS.deadlineMs)));
    for (const outcome of outcomes) {
      if (outcome === null) failures += 1;
      else latencies.push(outcome);
    }
  }
  const total = level * ARGS.repeats;
  const wallSeconds = (performance.now() - start) / 1000;
  const summary = latencies.length ? stats(latencies) : { mean: 0, p50: 0, p95: 0, p99: 0 };
  return {
    level, successes: latencies.length, failures, failurePct: (100 * failures) / total,
    meanMs: summary.mean, p50: summary.p50, p95: summary.p95, p99: summary.p99,
    throughput: latencies.length / wallSeconds,
  };
}

// Prints a table of the results to stdout.
function printTable(rows: Row[]): void {
  console.log("\n| level | ok | fail | fail% | mean ms | p50 | p95 | p99 | ops/s |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(
      `| ${row.level} | ${row.successes} | ${row.failures} | ${row.failurePct.toFixed(1)} | ${row.meanMs.toFixed(1)} | ` +
      `${row.p50.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.throughput.toFixed(1)} |`,
    );
  }
  const saturated = rows.find((row) => row.failurePct > 1);
  console.log(saturated ? `\nsaturation: first level with >1% unanswered = ${saturated.level}` : "\nno saturation observed at these levels");
}

async function main(): Promise<void> {
  console.log(`base URL     ${ARGS.baseUrl}`);
  console.log(`levels       ${ARGS.levels.join(", ")}   deadline ${ARGS.deadlineMs} ms   repeats ${ARGS.repeats}`);

  const suffix = `ld${Date.now().toString(36)}`;
  const session = await provisionSession(ARGS.baseUrl, suffix);
  console.log(`server       ${session.serverHeader}`);
  console.log(`pod          ${session.pod}\n`);

  const rows: Row[] = [];
  for (const level of ARGS.levels) {
    process.stdout.write(`running level=${level} ... `);
    const row = await runLevel(session.authFetch, session.pod, level);
    console.log(`${row.failures} failed (${row.failurePct.toFixed(0)}%), mean ${row.meanMs.toFixed(1)} ms, ${row.throughput.toFixed(1)} ops/s`);
    rows.push(row);
    // Early-abort: once a level is saturated there is no value climbing higher.
    if (row.failurePct >= ARGS.abortPct) {
      console.log(`\nsaturated at level=${level} (${row.failurePct.toFixed(0)}% unanswered ≥ ${ARGS.abortPct}%); stopping the ladder.`);
      break;
    }
  }

  printTable(rows);
  const outPath = writeResults("load", suffix, { args: ARGS, server: session.serverHeader, pod: session.pod, rows });
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
