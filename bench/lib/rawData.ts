/**
 * @packageDocumentation
 * Writes benchmark results as JSON and CSV files.
 *
 * The JSON output includes metadata and measured rows, while the CSV output
 * provides the same measurements in tabular form.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface RawDataMeta {
  // Name of the suite.
  suite: string;
  // Server identity.
  server: string;
  // URL of the server under test.
  baseUrl: string;
  // Commit hash of the server under test, if known.
  commit: string;
  // Samples aggregated into each data point ( our target is 1000).
  runsPerPoint: number;
  // Per-request timeout in milliseconds.
  deadlineMs?: number;
  // Any run-specific note worth carrying into the published dataset.
  notes?: string;
}

export interface Column<T> {
  key: keyof T;
  // CSV header including units.
  header: string;
}

// Lowercase filename segment
function filenamePart(input: string): string {
  const dashed = input.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return dashed.replace(/^-+|-+$/g, "") || "run";
}

// Returns the current UTC time in a compact format.
function utcStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

// Converts a value into a CSV-compatible representation.
function csvCell(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Writes the results of one benchmark run as JSON and CSV files.
 *
 * The label identifies the target environment in the generated filenames.
 */
export function writeRawData<T extends Record<string, unknown>>(
  label: string,
  meta: RawDataMeta,
  columns: Array<Column<T>>,
  rows: T[],
): { json: string; csv: string } {
  const rawDir = resolve(dirname(fileURLToPath(import.meta.url)), "../results/raw");
  mkdirSync(rawDir, { recursive: true });

  const base = `${filenamePart(meta.suite)}_${filenamePart(label)}_${utcStamp()}`;
  const jsonPath = resolve(rawDir, `${base}.json`);
  const csvPath = resolve(rawDir, `${base}.csv`);

  const stamped = { ...meta, generatedUtc: new Date().toISOString() };
  writeFileSync(jsonPath, `${JSON.stringify({ meta: stamped, rows }, null, 2)}\n`);

  const header = columns.map((column) => column.header).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(",")).join("\n");
  writeFileSync(csvPath, `${header}\n${body}\n`);

  return { json: jsonPath, csv: csvPath };
}
