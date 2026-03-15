export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

// ─── TBox ─────────────────────────────────────────────────────────────────────

const TBOX_TURTLE = `
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix app:    <https://example.com/app#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

# ── Classes ───────────────────────────────────────────────────────────────────

app:ImageFile a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Image File" ;
  rdfs:comment "A digital image such as a photo, illustration, or graphic." .

app:VideoFile a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Video File" ;
  rdfs:comment "A video recording such as a movie, clip, or screen capture." .

app:AudioFile a rdfs:Class ;
  rdfs:subClassOf schema:DigitalDocument ;
  rdfs:label "Audio File" ;
  rdfs:comment "An audio recording such as music, a podcast, or a voice note." .

app:TextDocument a rdfs:Class ;
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

schema:uploadDate a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:dateTime .

schema:dateModified a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range xsd:dateTime .

schema:publisher a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range rdfs:Resource .

schema:sharedWith a rdf:Property ;
  rdfs:domain schema:DigitalDocument ; rdfs:range rdfs:Resource .
`.trim();


export const FILE_TYPE_DEFS = [
  { uri: "http://schema.org/DigitalDocument", id: "DigitalDocument", label: "File", description: "Any general file" },
  { uri: "https://example.com/app#ImageFile", id: "ImageFile", label: "Photo/Image", description: "Pictures/graphics" },
  { uri: "https://example.com/app#VideoFile", id: "VideoFile", label: "Video", description: "Videos/movie clips" },
  { uri: "https://example.com/app#AudioFile", id: "AudioFile", label: "Audio", description: "Music, podcasts, recordings" },
  { uri: "https://example.com/app#TextDocument", id: "TextDocument", label: "Document", description: "PDFs/text/Word files" },
];

export function friendlyLabel(uriOrId: string): string {
  const match = FILE_TYPE_DEFS.find(
    (classDefinition) => classDefinition.uri === uriOrId || classDefinition.id === uriOrId || classDefinition.uri.endsWith(`#${uriOrId}`)
  );
  if (match) return match.label;
  return uriOrId.split(/[#/]/).pop() ?? uriOrId;
}

export async function ensureTBox(storageRoot: string, fetch: FetchFn): Promise<void> {
  const tboxUri = `${storageRoot}tbox.ttl`;
  const headResponse = await fetch(tboxUri, { method: "HEAD" });
  if (headResponse.ok) return;
  const putRes = await fetch(tboxUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: TBOX_TURTLE,
  });
  if (!putRes.ok) {
    throw new Error(`Failed to write tbox.ttl: ${putRes.status} ${putRes.statusText}`);
  }
}

const APP = "https://example.com/app#";

export function resolveClass(contentType: string): string {
  if (contentType.startsWith("image/")) return `${APP}ImageFile`;
  if (contentType.startsWith("video/")) return `${APP}VideoFile`;
  if (contentType.startsWith("audio/")) return `${APP}AudioFile`;
  if (
    contentType.startsWith("text/") ||
    contentType === "application/pdf" ||
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return `${APP}TextDocument`;
  }
  return "http://schema.org/DigitalDocument";
}

const CATALOG_PREFIXES = `
PREFIX dcat:    <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX schema:  <http://schema.org/>
`.trim();

const EMPTY_CATALOG_TURTLE = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema:  <http://schema.org/> .
`.trim();

export async function appendToCatalog(
  storageRoot: string,
  instanceUri: string,
  classUri: string,
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

// prevents duplicates on retry
const sparql = `${CATALOG_PREFIXES}

INSERT {
  <${instanceUri}> a dcat:Dataset ;
    dcterms:conformsTo <${classUri}> ;
    dcat:distribution <${instanceUri}> .
}
WHERE {
  FILTER NOT EXISTS { <${instanceUri}> a dcat:Dataset }
}
`.trim();

  const patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": "application/sparql update" },
    body: sparql,
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

  const sparql = `${CATALOG_PREFIXES}

DELETE WHERE {
  <${instanceUri}> ?predicate ?object .
}
`.trim();

  const patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content Type": "application/sparql update" },
    body: sparql,
  });
  if (!patchResponse.ok) {
    throw new Error(`Failed to remove entry from catalog.ttl: ${patchResponse.status} ${patchResponse.statusText}`);
  }
}
