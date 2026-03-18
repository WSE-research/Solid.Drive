export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

// ─── TBox ─────────────────────────────────────────────────────────────────────

const TBOX_TURTLE = `
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix schema: <http://schema.org/> .
@prefix sd:     <https://w3id.org/solid-drive#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

# ── Classes ───────────────────────────────────────────────────────────────────

sd:ImageFile a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Image File" ;
  rdfs:comment "A digital image such as a photo, illustration, or graphic." .

sd:VideoFile a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Video File" ;
  rdfs:comment "A video recording such as a movie, clip, or screen capture." .

sd:AudioFile a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Audio File" ;
  rdfs:comment "An audio recording such as music, a podcast, or a voice note." .

sd:TextDocument a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Text Document" ;
  rdfs:comment "A text-based document such as a PDF, Word file, or plain text." .

# ── Properties ────────────────────────────────────────────────────────────────

schema:name a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:string .

schema:description a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:string .

schema:encodingFormat a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:string .

schema:contentSize a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:string .

schema:dateModified a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:dateTime .

schema:sharedWith a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range rdfs:Resource .

# ── Required property constraints ───────────────────────────

schema:uploadDate a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:dateTime .

schema:DigitalDocument rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty schema:uploadDate ;
  owl:minCardinality 1
] .

schema:publisher a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range rdfs:Resource .

schema:DigitalDocument rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty schema:publisher ;
  owl:minCardinality 1
] .
`.trim();

// ─── Class map ────────────────────────────────────────────────────────────────

const FILE_TYPE_DEFS = [
  { uri: "http://schema.org/DigitalDocument", id: "DigitalDocument", label: "File", description: "Any general file" },
  { uri: "https://w3id.org/solid-drive#ImageFile", id: "ImageFile", label: "Photo/Image", description: "Pictures/graphics" },
  { uri: "https://w3id.org/solid-drive#VideoFile", id: "VideoFile", label: "Video", description: "Videos/movie clips" },
  { uri: "https://w3id.org/solid-drive#AudioFile", id: "AudioFile", label: "Audio", description: "Music, podcasts, recordings" },
  { uri: "https://w3id.org/solid-drive#TextDocument", id: "TextDocument", label: "Document", description: "PDFs/text/Word files" },
];

export function friendlyLabel(uriOrId: string): string {
  const typeDef = FILE_TYPE_DEFS.find(
    (entry) => entry.uri === uriOrId || entry.id === uriOrId || entry.uri.endsWith(`#${uriOrId}`)
  );
  if (typeDef) return typeDef.label;
  return uriOrId.split(/[#/]/).pop() ?? uriOrId;
}

export async function ensureTBox(storageRoot: string, fetch: FetchFn): Promise<void> {
  const tboxUri = `${storageRoot}tbox.ttl`;
  const headResponse = await fetch(tboxUri, { method: "HEAD" });
  if (headResponse.ok) return;
  const putResponse = await fetch(tboxUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: TBOX_TURTLE,
  });
  if (!putResponse.ok) {
    throw new Error(`Failed to write tbox.ttl: ${putResponse.status} ${putResponse.statusText}`);
  }
}

const APP_NAMESPACE = "https://w3id.org/solid-drive#";

export function resolveClass(contentType: string): string {
  if (contentType.startsWith("image/")) return `${APP_NAMESPACE}ImageFile`;
  if (contentType.startsWith("video/")) return `${APP_NAMESPACE}VideoFile`;
  if (contentType.startsWith("audio/")) return `${APP_NAMESPACE}AudioFile`;
  if (
    contentType.startsWith("text/") ||
    contentType === "application/pdf" ||
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return `${APP_NAMESPACE}TextDocument`;
  }
  return "http://schema.org/DigitalDocument";
}

// ─── DCAT 3 Catalog ───────────────────────────────────────────────────────────

const CATALOG_SPARQL_PREFIXES = `
PREFIX dcat:    <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd:     <http://www.w3.org/2001/XMLSchema#>
`.trim();

const EMPTY_CATALOG_TURTLE = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

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
  storageRoot: string,
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
  const catalogUri = `${storageRoot}catalog.ttl`;
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
  storageRoot: string,
  instanceUri: string,
  fetch: FetchFn
): Promise<void> {
  const catalogUri = `${storageRoot}catalog.ttl`;
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
  storageRoot: string,
  webId: string,
  fetch: FetchFn
): Promise<void> {
  const catalogUri = `${storageRoot}catalog.ttl`;
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
