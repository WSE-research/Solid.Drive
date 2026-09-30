/**
 * @packageDocumentation
 * The RDF namespace URIs both write methods build the same DCAT triples from,
 * kept in one place so `buildN3Patch` and `catalogWriteMethods` can't drift
 * against each other. These mirror the app's `RDF_NAMESPACES` (src/config);
 * inlined rather than imported from there, to keep this dependency-free for
 * the tsx runner.
 */

export const SOLID_NS = "http://www.w3.org/ns/solid/terms#";
export const DCAT_NS = "http://www.w3.org/ns/dcat#";
export const DCTERMS_NS = "http://purl.org/dc/terms/";
export const XSD_NS = "http://www.w3.org/2001/XMLSchema#";
export const SD_NS = "https://purl.org/solid-drive/catalog#";
export const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// Fragment identifying an entry's distribution, relative to its instance URI.
export const DISTRIBUTION_FRAGMENT = "#dist";
