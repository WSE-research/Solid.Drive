/**
 * @packageDocumentation
 * Measures the client-side memory cost of appending an entry to a catalog as the catalog grows. 
 * 
 * The soft-delete process uses a whole-document GET+PUT to update the catalog. 
 * To add a single entry the client must download the entire catalog and hold it in memory. 
 * 
 * The N3 Patch method however sends only the insert delta and never reads the catalog
 * therefore its client-side memory cost remains independent of catalog size.
 * 
 * In this suite we measure both methods, as supporting evidence for the write-method
 * latency-and-cost result: it's the reason GET+PUT gets slower as the catalog grows, 
 * and why N3 Patch is O(1) by construction.
 * 
 * For each catalog size we seed one catalog, and measure both write methods:
 *   - PUT appends by rewriting the whole document. First it GETs the catalog and
 *       parses it into an RDF store, so we report:
 *     - heap: memory that parsed store takes up
 *     - body: serialized catalog length, i.e. the bytes PUT sends back
 *   Both climb with the number of entries.
 *  - N3 Patch appends by sending a delta. It never reads the catalog, so we report:
 *     - heap: memory that the delta takes up
 *     - body: serialized delta length, i.e. the bytes Patch sends back
 */

import { hostname } from "node:os";
import { Parser, Store } from "n3";
import { provisionSession } from "../../lib/podSession.ts";
import { seedCatalog } from "../../lib/catalogWriteMethods.ts";
import { catalogEntryMaker } from "../../lib/catalogEntry.ts";
import { buildN3Patch, type CatalogAppend } from "../../lib/buildN3Patch.ts";
import { stats } from "../../lib/stats.ts";
import { writeRawData, type Column } from "../../lib/rawData.ts";

interface Args {
  baseUrl: string;
  catalogSizes: number[];
  methods: string[];
  reps: number;
  byteSize: number;
  label: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseUrl: "",
    catalogSizes: [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384],
    methods: ["put", "n3patch"],
    reps: 1000,
    byteSize: 64 * 1024,
    label: "",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--catalog-sizes") args.catalogSizes = value.split(",").map(Number);
    else if (flag === "--methods") args.methods = value.split(",");
    else if (flag === "--reps") args.reps = Number(value);
    else if (flag === "--size-kb") args.byteSize = Number(value) * 1024;
    else if (flag === "--label") args.label = value;
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

const makeEntry = catalogEntryMaker(ARGS.byteSize);

// Run GC twice so pending finalizers settle before we read the heap baseline.
function collectGarbage(): void {
  if (typeof global.gc === "function") {
    global.gc();
    global.gc();
  }
}

// Heap held to load a catalog for rewriting (the PUT method), 
// which grows with catalog size. 
function measurePutLoad(catalogUri: string, catalogText: string): number {
  collectGarbage();
  const baseline = process.memoryUsage().heapUsed;
  const store = new Store(new Parser({ baseIRI: catalogUri }).parse(catalogText));

  collectGarbage();
  const held = process.memoryUsage().heapUsed - baseline;
  if (store.size < 0) throw new Error("unreachable"); // keep the store alive past the measurement
  return held;
}

// Heap held to build an N3 Patch for appending an entry (the N3 Patch method), 
// which is independent of catalog size.
function measurePatchBuild(entry: CatalogAppend): { heap: number; bytes: number } {
  collectGarbage();
  const baseline = process.memoryUsage().heapUsed;
  const body = buildN3Patch(entry);
  const heap = process.memoryUsage().heapUsed - baseline;
  return { heap: Math.max(0, heap), bytes: Buffer.byteLength(body) };
}

interface Row extends Record<string, unknown> {
  method: string;
  catalogEntries: number;
  heapBytes: number;
  heapKiB: number;
  bodyBytes: number;
  bodyKiB: number;
  reps: number;
}

const COLUMNS: Array<Column<Row>> = [
  { key: "method", header: "method" },
  { key: "catalogEntries", header: "catalog_entries" },
  { key: "heapBytes", header: "heap_bytes" },
  { key: "heapKiB", header: "heap_kib" },
  { key: "bodyBytes", header: "body_bytes" },
  { key: "bodyKiB", header: "body_kib" },
  { key: "reps", header: "reps" },
];

async function main(): Promise<void> {
  if (typeof global.gc !== "function") {
    console.warn("WARNING: run with NODE_OPTIONS=--expose-gc for a clean heap baseline; numbers will be noisier without it.\n");
  }
  console.log(`base URL ${ARGS.baseUrl}`);
  console.log(`methods ${ARGS.methods.join(", ")}`);
  console.log(`catalog sizes ${ARGS.catalogSizes.join(", ")}`);
  console.log(`reps ${ARGS.reps} entry byteSize ${(ARGS.byteSize / 1024).toFixed(0)} KB (metadata field only, nothing transferred)\n`);

  const { authFetch, pod: podUrl, webId, serverHeader } = await provisionSession(ARGS.baseUrl, `mc${Date.now().toString(36)}`);

  const rows: Row[] = [];
  console.log("| method | catalog | heap KiB | body KiB |");
  console.log("| --- | --- | --- | --- |");
  for (const catalogEntries of ARGS.catalogSizes) {
    const catalogUri = `${podUrl}bench-mem/cat-${catalogEntries}.ttl`;
    await seedCatalog(authFetch, catalogUri, catalogEntries, (index) => ({
      ...makeEntry(podUrl, webId, `seed-${catalogEntries}-${index}`), catalogUri,
    }));
    const catalogText = await authFetch(catalogUri).then((response) => response.text());
    const entry = { ...makeEntry(podUrl, webId, `append-${catalogEntries}`), catalogUri };

    for (const method of ARGS.methods) {
      let heapBytes: number;
      let bodyBytes: number;
      if (method === "put") {
        heapBytes = stats(Array.from({ length: ARGS.reps }, () => measurePutLoad(catalogUri, catalogText))).p50;
        bodyBytes = Buffer.byteLength(catalogText); // the whole document the PUT re-sends
      } else {
        const samples = Array.from({ length: ARGS.reps }, () => measurePatchBuild(entry));
        heapBytes = stats(samples.map((sample) => sample.heap)).p50;
        bodyBytes = samples[0].bytes;
      }
      const row: Row = {
        method, catalogEntries, heapBytes, heapKiB: Math.round(heapBytes / 1024),
        bodyBytes, bodyKiB: Math.round(bodyBytes / 1024), reps: ARGS.reps,
      };
      rows.push(row);
      console.log(`| ${method} | ${catalogEntries} | ${row.heapKiB} | ${row.bodyKiB} |`);
    }
    await authFetch(catalogUri, { method: "DELETE" }).catch(() => undefined);
  }

  const label = ARGS.label || serverHeader.split("/")[0] || hostname();
  const paths = writeRawData<Row>(label, {
    suite: "memory-cost",
    server: serverHeader,
    baseUrl: ARGS.baseUrl,
    commit: process.env.BENCH_COMMIT ?? "unknown",
    runsPerPoint: ARGS.reps,
    deadlineMs: 0,
    notes: "client heap to hold the catalog for a whole-document PUT append, against the heap to build an N3 Patch; heap is the median over reps, body the bytes each method sends",
  }, COLUMNS, rows);
  console.log(`\nwrote ${paths.json}\n      ${paths.csv}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
