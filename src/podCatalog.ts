import { Parser as N3Parser, Store as N3Store } from "n3";

export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

// Reject any URI that would break out of an angle-bracket IRI token in SPARQL/Turtle
function assertSafeUri(uri: string): void {
  if (/[>\s]/.test(uri)) throw new Error(`Unsafe URI rejected for SPARQL interpolation: "${uri}"`);
}

// Central file type mapping used to connect schema.org classes to UI labels
const FILE_TYPE_DEFS = [
  { uri: "http://schema.org/DigitalDocument", id: "DigitalDocument", label: "File", description: "Any general file" },
  { uri: "http://schema.org/ImageObject", id: "ImageObject", label: "Photo/Image", description: "Pictures/graphics" },
  { uri: "http://schema.org/VideoObject", id: "VideoObject", label: "Video", description: "Videos/movie clips" },
  { uri: "http://schema.org/AudioObject", id: "AudioObject", label: "Audio", description: "Music, podcasts, recordings" },
  { uri: "http://schema.org/TextDigitalDocument", id: "TextDigitalDocument", label: "Document", description: "PDFs, text, Word files" },
  { uri: "http://schema.org/SpreadsheetDigitalDocument", id: "SpreadsheetDigitalDocument", label: "Spreadsheet", description: "Excel, CSV, etc." },
];

// Returns whether the given type is one the app recognizes
export function isKnownType(uriOrId: string): boolean {
  return FILE_TYPE_DEFS.some(
    (entry) => entry.uri === uriOrId || entry.id === uriOrId || entry.uri.endsWith(`#${uriOrId}`)
  );
}

// Returns the UI label for a supported file type
export function friendlyLabel(uriOrId: string): string {
  return friendlyTypeInfo(uriOrId).label;
}

// Returns the UI label and description for a file type
export function friendlyTypeInfo(uriOrId: string): { label: string; description: string } {
  const typeDef = FILE_TYPE_DEFS.find(
    (entry) => entry.uri === uriOrId || entry.id === uriOrId || entry.uri.endsWith(`#${uriOrId}`)
  );
  if (typeDef) return { label: typeDef.label, description: typeDef.description };
  const fallback = uriOrId.split(/[#/]/).pop() ?? uriOrId;
  return { label: fallback, description: "" };
}

// Map MIME types to the closest schema.org class we support
export function resolveClass(contentType: string): string {
  if (contentType.startsWith("image/")) return "http://schema.org/ImageObject";
  if (contentType.startsWith("video/")) return "http://schema.org/VideoObject";
  if (contentType.startsWith("audio/")) return "http://schema.org/AudioObject";
  if (
    contentType === "text/csv" ||
    contentType === "application/vnd.ms-excel" ||
    contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) return "http://schema.org/SpreadsheetDigitalDocument";
  if (
    contentType.startsWith("text/") ||
    contentType === "application/pdf" ||
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    contentType === "application/rtf"
  ) return "http://schema.org/TextDigitalDocument";
  return "http://schema.org/DigitalDocument";
}

// ── DCAT catalog management ────────────────────────────────────────────

const CATALOG_SPARQL_PREFIXES = `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`.trim();

// Minimal starting catalog for first-time setup
const EMPTY_CATALOG_TURTLE = `
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a dcat:Catalog .
`.trim();

export interface CatalogEntry {
  uri: string;
  conformsTo: string;
  title: string;
  description: string;
  modified: string;
  publisher: string;
  mediaType: string;
  byteSize: number;
  accessURL: string;
}

/**
 * Add a dataset entry and matching distribution to the catalog
 * Uses SPARQL PATCH so updates do not replace the full document
 * Creates the catalog first if it does not exist yet
 */
export async function appendToCatalog(
  catalogUri: string,
  instanceUri: string,
  binaryUri: string,
  classUri: string,
  mediaType: string,
  byteSize: number,
  title: string,
  description: string,
  modified: string,
  publisherWebId: string,
  fetch: FetchFn
): Promise<void> {
  assertSafeUri(catalogUri);
  assertSafeUri(instanceUri);
  assertSafeUri(binaryUri);
  assertSafeUri(classUri);
  assertSafeUri(publisherWebId);
  // Create the catalog only if it does not exist yet
  const headResponse = await fetch(catalogUri, { method: "HEAD" });
  if (!headResponse.ok) {
    const putResponse = await fetch(catalogUri, {
      method: "PUT",
      headers: { "Content-Type": "text/turtle" },
      body: EMPTY_CATALOG_TURTLE,
    });
    if (!putResponse.ok) {
      throw new Error(`Failed to create catalog.ttl: ${putResponse.status} ${putResponse.statusText}`);
    }
  }

  // Escape user text before inserting it into Turtle literals
  const escapeTurtleLiteral = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

  // Only include description when one was provided
  const descriptionTriple = description.trim()
    ? `\n    dcterms:description "${escapeTurtleLiteral(description)}" ;`
    : "";

  const sparqlUpdate = `${CATALOG_SPARQL_PREFIXES}

  INSERT DATA {
    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset ;
      dcterms:conformsTo <${classUri}> ;
      dcterms:title "${escapeTurtleLiteral(title)}" ;${descriptionTriple}
      dcterms:modified "${modified}"^^xsd:dateTime ;
      dcterms:publisher <${publisherWebId}> ;
      dcat:distribution <${instanceUri}#dist> .
    <${instanceUri}#dist> a dcat:Distribution ;
      dcat:accessURL <${binaryUri}> ;
      dcat:mediaType "${escapeTurtleLiteral(mediaType)}" ;
      dcat:byteSize ${byteSize} .
  }
`.trim();

  const patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": "application/sparql-update" },
    body: sparqlUpdate,
  });
  if (!patchResponse.ok) {
    throw new Error(`Failed to update catalog.ttl: ${patchResponse.status} ${patchResponse.statusText}`);
  }
}

/**
 * Removes a dataset and its distribution from the catalog in a single SPARQL
 * DELETE WHERE PATCH, preventing orphaned #dist resources.  Silently returns
 * if the catalog doesn't exist — nothing to remove.
 */
export async function removeFromCatalog(
  catalogUri: string,
  instanceUri: string,
  fetch: FetchFn
): Promise<void> {
  assertSafeUri(catalogUri);
  assertSafeUri(instanceUri);
  const headResponse = await fetch(catalogUri, { method: "HEAD" });
  if (!headResponse.ok) return;

  const sparqlUpdate = `${CATALOG_SPARQL_PREFIXES}

  DELETE WHERE { <${catalogUri}> dcat:dataset <${instanceUri}> . <${instanceUri}> ?p ?v . } ;
  DELETE WHERE { <${instanceUri}#dist> ?p ?v . }
`.trim();

  const patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": "application/sparql-update" },
    body: sparqlUpdate,
  });
  if (!patchResponse.ok) {
    throw new Error(`Failed to remove entry from catalog.ttl: ${patchResponse.status} ${patchResponse.statusText}`);
  }
}

// Parse catalog entries from Turtle text using N3 so URIs with dots or
// multi-line literals don't cause premature block termination.
export function parseCatalog(turtleText: string): CatalogEntry[] {
  let quads;
  try {
    quads = new N3Parser().parse(turtleText);
  } catch {
    return [];
  }

  const store = new N3Store(quads);
  const DCAT = "http://www.w3.org/ns/dcat#";
  const DCTERMS = "http://purl.org/dc/terms/";

  const datasetUris = store.getObjects(null, `${DCAT}dataset`, null).map((t) => t.value);

  const val = (subject: string, predicate: string) =>
    store.getObjects(subject, predicate, null)[0]?.value ?? "";

  return datasetUris.map((datasetUri) => {
    const distUri = val(datasetUri, `${DCAT}distribution`);
    return {
      uri: datasetUri,
      conformsTo: val(datasetUri, `${DCTERMS}conformsTo`),
      title: val(datasetUri, `${DCTERMS}title`),
      description: val(datasetUri, `${DCTERMS}description`),
      modified: val(datasetUri, `${DCTERMS}modified`),
      publisher: val(datasetUri, `${DCTERMS}publisher`),
      mediaType: val(distUri, `${DCAT}mediaType`),
      byteSize: parseInt(val(distUri, `${DCAT}byteSize`) || "0", 10),
      accessURL: val(distUri, `${DCAT}accessURL`),
    };
  });
}

/**
 * Add a dcat:catalog link from the user's profile to the catalog document
 * Uses the profile document URI, not the WebID fragment
 */
export async function linkCatalogToProfile(
  catalogUri: string,
  webId: string,
  fetch: FetchFn
): Promise<void> {
  assertSafeUri(catalogUri);
  // Strip the fragment (#me, #this, etc.) to get the patchable document URI
  const profileDocUri = webId.split("#")[0];

  const sparqlUpdate = `PREFIX dcat: <http://www.w3.org/ns/dcat#>

INSERT DATA {
  <${profileDocUri}> dcat:catalog <${catalogUri}> .
}`.trim();

  const response = await fetch(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": "application/sparql-update" },
    body: sparqlUpdate,
  });
  if (!response.ok) {
    throw new Error(`Failed to link catalog to profile: ${response.status} ${response.statusText}`);
  }
}
