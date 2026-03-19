export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

// Filetype definitions and utilities
const FILE_TYPE_DEFS = [
  { uri: "http://schema.org/DigitalDocument", id: "DigitalDocument", label: "File", description: "Any general file" },
  { uri: "http://schema.org/ImageObject", id: "ImageObject", label: "Photo/Image", description: "Pictures/graphics" },
  { uri: "http://schema.org/VideoObject", id: "VideoObject", label: "Video", description: "Videos/movie clips" },
  { uri: "http://schema.org/AudioObject", id: "AudioObject", label: "Audio", description: "Music, podcasts, recordings" },
  { uri: "http://schema.org/TextDigitalDocument", id: "TextDigitalDocument",  label: "Document",    description: "PDFs, text, Word files" },
  { uri: "http://schema.org/SpreadsheetDigitalDocument", id: "SpreadsheetDigitalDocument", label: "Spreadsheet", description: "Excel, CSV, etc." },
];

export function friendlyLabel(uriOrId: string): string {
  const typeDef = FILE_TYPE_DEFS.find(
    (entry) => entry.uri === uriOrId || entry.id === uriOrId || entry.uri.endsWith(`#${uriOrId}`)
  );
  if (typeDef) return typeDef.label;
  return uriOrId.split(/[#/]/).pop() ?? uriOrId;
}

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

// DCAT Catalog management
const CATALOG_SPARQL_PREFIXES = `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`.trim();

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

  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

  const descriptionTriple = description.trim()
    ? `\n    dcterms:description "${escape(description)}" ;`
    : "";

  const sparqlUpdate = `${CATALOG_SPARQL_PREFIXES}

  INSERT DATA {
    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset ;
      dcterms:conformsTo <${classUri}> ;
      dcterms:title "${escape(title)}" ;${descriptionTriple}
      dcterms:modified "${modified}"^^xsd:dateTime ;
      dcterms:publisher <${publisherWebId}> ;
      dcat:distribution <${instanceUri}#dist> .
    <${instanceUri}#dist> a dcat:Distribution ;
      dcat:accessURL <${binaryUri}> ;
      dcat:mediaType "${mediaType}" ;
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

export async function removeFromCatalog(
  catalogUri: string,
  instanceUri: string,
  fetch: FetchFn
): Promise<void> {
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

export function parseCatalog(turtleText: string): CatalogEntry[] {
  const datasetUris = [...turtleText.matchAll(/dcat:dataset\s+<([^>]+)>/g)].map(
    (regexMatch) => regexMatch[1]
  );

  return datasetUris.map((datasetUri) => {

    const blockFor = (uri: string) => {
      const escaped = uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return turtleText.match(
        new RegExp(`^[ \\t]*<${escaped}>\\s[\\s\\S]*?\\.(?=[ \\t]*(?:\\n|$))`, "m")
      )?.[0] ?? "";
    };

    const datasetBlock = blockFor(datasetUri);
    const distBlock = blockFor(`${datasetUri}#dist`);

    const iri = (predicate: string, block: string) =>
      block.match(new RegExp(`${predicate}\\s+<([^>]+)>`))?.[1] ?? "";
    const str = (predicate: string, block: string) =>
      block.match(new RegExp(`${predicate}\\s+"((?:[^"\\\\]|\\\\.)*)`))?.[1] ?? "";
    const int = (predicate: string, block: string) =>
      parseInt(block.match(new RegExp(`${predicate}\\s+(\\d+)`))?.[1] ?? "0", 10);

    return {
      uri: datasetUri,
      conformsTo: iri("dcterms:conformsTo", datasetBlock),
      title: str("dcterms:title", datasetBlock),
      description: str("dcterms:description", datasetBlock),
      modified: str("dcterms:modified", datasetBlock),
      publisher: iri("dcterms:publisher", datasetBlock),
      mediaType: str("dcat:mediaType", distBlock),
      byteSize: int("dcat:byteSize", distBlock),
      accessURL: iri("dcat:accessURL", distBlock),
    };
  });
}

export async function linkCatalogToProfile(
  catalogUri: string,
  webId: string,
  fetch: FetchFn
): Promise<void> {
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
