/**
 * @packageDocumentation
 * Measures the client-side memory cost of a soft-delete catalog append as the catalog grows.
 * The soft delete process appends through a whole-document GET+PUT: 
 * the client downloads the entire catalog, parses it into an RDF store,
 * adds the entry, and re-serializes. 
 * Peak resident memory is what that costs, and it grows with the pod content.
 *
 * Since the N3 Patch method is O(1). This suite measures the GET+PUT method, 
 * while the Patch memory cost is represented by the runtime floor.
 */

import { hostname } from "node:os";
import { provisionSession } from "../../lib/podSession.ts";
import { putAppend, patchAppend, seedCatalog } from "../../lib/catalogWriteMethods.ts";
import { catalogEntryMaker } from "../../lib/catalogEntry.ts";
import { writeRawData, type Column } from "../../lib/rawData.ts";

interface Args {
  baseUrl: string;
  catalogSize: number;
  method: string;
  byteSize: number;
  label: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { baseUrl: "", catalogSize: 0, method: "put", byteSize: 64 * 1024, label: "" };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value.endsWith("/") ? value : `${value}/`;
    else if (flag === "--catalog-size") args.catalogSize = Number(value);
    else if (flag === "--method") args.method = value;
    else if (flag === "--size-kb") args.byteSize = Number(value) * 1024;
    else if (flag === "--label") args.label = value;
  }
  if (!args.baseUrl) throw new Error("--base-url is required");
  if (!args.catalogSize) throw new Error("--catalog-size is required");
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

const makeEntry = catalogEntryMaker(ARGS.byteSize);

interface Row extends Record<string, unknown> {
  method: string;
  catalogEntries: number;
  maxRssKiB: number;
  maxRssMiB: number;
  rssKiB: number;
  heapUsedKiB: number;
}

const COLUMNS: Array<Column<Row>> = [
  { key: "method", header: "method" },
  { key: "catalogEntries", header: "catalog_entries" },
  { key: "maxRssKiB", header: "max_rss_kib" },
  { key: "maxRssMiB", header: "max_rss_mib" },
  { key: "rssKiB", header: "rss_kib" },
  { key: "heapUsedKiB", header: "heap_used_kib" },
];

async function main(): Promise<void> {
  console.log(`base URL      ${ARGS.baseUrl}`);
  console.log(`catalog size  ${ARGS.catalogSize}   method ${ARGS.method}\n`);

  const { authFetch, pod: podUrl, webId, serverHeader } = await provisionSession(ARGS.baseUrl, `mr${Date.now().toString(36)}`);

  const catalogUri = `${podUrl}bench-rss/cat-${ARGS.catalogSize}.ttl`;
  await seedCatalog(authFetch, catalogUri, ARGS.catalogSize, (index) => ({
    ...makeEntry(podUrl, webId, `seed-${ARGS.catalogSize}-${index}`), catalogUri,
  }));

  // The measured operation: one real append. PUT re-reads and re-writes the whole catalog; 
  // Patch sends only the delta and never loads it.
  const entry = { ...makeEntry(podUrl, webId, `append-${ARGS.catalogSize}`), catalogUri };
  const append = ARGS.method === "n3patch" ? patchAppend : putAppend;
  await append(authFetch, catalogUri, entry);

  const maxRssKiB = process.resourceUsage().maxRSS; 
  const memory = process.memoryUsage();
  const row: Row = {
    method: ARGS.method,
    catalogEntries: ARGS.catalogSize,
    maxRssKiB,
    maxRssMiB: Math.round((maxRssKiB / 1024) * 10) / 10,
    rssKiB: Math.round(memory.rss / 1024),
    heapUsedKiB: Math.round(memory.heapUsed / 1024),
  };
  console.log(`peak RSS ${row.maxRssMiB} MiB (current rss ${Math.round(row.rssKiB / 1024)} MiB)`);

  await authFetch(catalogUri, { method: "DELETE" }).catch(() => undefined);

  const label = ARGS.label || serverHeader.split("/")[0] || hostname();
  const paths = writeRawData<Row>(label, {
    suite: "memory-rss",
    server: serverHeader,
    baseUrl: ARGS.baseUrl,
    commit: process.env.BENCH_COMMIT ?? "unknown",
    runsPerPoint: 1,
    deadlineMs: 0,
    notes: "peak resident memory of the client doing one whole-document PUT append to a catalog of the given size; one size per process, so the reading is that size's peak",
  }, COLUMNS, [row]);
  console.log(`wrote ${paths.csv}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
