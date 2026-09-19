/**
 * @packageDocumentation
 * Shared helpers for the delete benchmarks: argument parsing, bounded
 * concurrency, averaging, sample data, and result writing.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeRawData, type Column } from "../../lib/rawData";

export interface Sample {
  latencyMs: number;
  requests: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface GridArgs {
  baseUrl: string;
  sizesKb: number[];
  trashSizes: number[];
  methods: string[];
  concurrency: number[];
  repeats: number;
}

// Parses the common grid arguments.
export function parseGridArgs(argv: string[], defaults: Omit<GridArgs, "baseUrl">): GridArgs {
  const args: GridArgs = { baseUrl: "", ...defaults };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--sizes-kb") args.sizesKb = value.split(",").map(Number);
    else if (flag === "--trash-sizes") args.trashSizes = value.split(",").map(Number);
    else if (flag === "--methods") args.methods = value.split(",");
    else if (flag === "--concurrency") args.concurrency = value.split(",").map(Number);
    else if (flag === "--repeats") args.repeats = Number(value);
  }
  if (!args.baseUrl) {
    throw new Error("--base-url is required (e.g. --base-url https://wse-research.org/solid-community-server/)");
  }
  return args;
}

// Runs tasks with a fixed concurrency limit while preserving order.
export async function mapPool<T, R>(items: T[], poolSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(poolSize, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

export const meanOf = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

interface ResultsPayload {
  server?: string;
  args?: { baseUrl?: string; repeats?: number; deadlineMs?: number };
  rows?: Array<Record<string, unknown>>;
}

// Converts a result key to a CSV header.
function toSnakeCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();
}

/**
 * Writes the benchmark results to JSON and, when rows are present,
 * also writes the raw JSON and CSV files.
 */
export function writeResults(name: string, suffix: string, payload: object): string {
  const resultsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../results");
  mkdirSync(resultsDir, { recursive: true });
  const outPath = resolve(resultsDir, `${name}-${suffix}.json`);
  writeFileSync(outPath, JSON.stringify({ ...payload, timestamp: new Date().toISOString() }, null, 2));

  const { server, args, rows } = payload as ResultsPayload;
  if (Array.isArray(rows) && rows.length > 0) {
    const columns: Array<Column<Record<string, unknown>>> = Object.keys(rows[0])
      .filter((key) => key !== "samples")
      .map((key) => ({ key, header: toSnakeCase(key) }));
    const label = process.env.BENCH_LABEL || (server ?? "server").split("/")[0] || "server";
    writeRawData<Record<string, unknown>>(label, {
      suite: name,
      server: server ?? "unknown",
      baseUrl: args?.baseUrl ?? "",
      commit: process.env.BENCH_COMMIT ?? "unknown",
      runsPerPoint: args?.repeats ?? 0,
      deadlineMs: args?.deadlineMs,
    }, columns, rows);
  }
  return outPath;
}
