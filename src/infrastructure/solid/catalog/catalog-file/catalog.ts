/**
 * DCAT catalog operations for Solid pods.
 *
 * @remarks
 * Provides CRUD operations for DCAT catalogs stored as Turtle files.
 * Uses SPARQL UPDATE for modifications and N3 for parsing.
 *
 * @packageDocumentation
 */

import { Parser as N3Parser, Store as N3Store } from "n3";
import type { FetchFn, CatalogEntry } from "@/types";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";
import {
  DEFAULT_CATALOG_FILENAME,
  RDF_NAMESPACES,
  CONTENT_TYPES,
} from "@/config";

/**
 * Validates that a URI is safe for SPARQL/Turtle interpolation.
 *
 * @remarks
 * Rejects URIs containing `>` or whitespace which could break angle-bracket IRI tokens.
 *
 * @param uri - The URI to validate
 * @throws Error if the URI contains unsafe characters
 *
 * @internal
 */
function assertSafeUri(uri: string): void {
  if (/[>\s]/.test(uri)) throw new Error(`Unsafe URI rejected for SPARQL interpolation: "${uri}"`);
}

const DISTRIBUTION_FRAGMENT = "#dist";

const CATALOG_SPARQL_PREFIXES = `
PREFIX dcat: <${RDF_NAMESPACES.DCAT}>
PREFIX dcterms: <${RDF_NAMESPACES.DCTERMS}>
PREFIX xsd: <${RDF_NAMESPACES.XSD}>
`.trim();

/**
 * Minimal Turtle template for an empty DCAT catalog.
 *
 * @public
 */
export const EMPTY_CATALOG_TURTLE = `@prefix dcat: <${RDF_NAMESPACES.DCAT}> .

<> a dcat:Catalog .
`;

/**
 * Resolves the catalog URI for a user.
 *
 * @remarks
 * Prefers the profile-linked catalog (`dcat:catalog`), falling back to
 * the default location under the storage root.
 *
 * @param profile - The user's Solid profile
 * @param storageRoot - The user's pod storage root URI
 * @returns The resolved catalog URI, or undefined if no storage root
 *
 * @public
 */
export function resolveCatalogUri(
  profile: SolidProfile | undefined | null,
  storageRoot: string | undefined
): string | undefined {
  if (!storageRoot) return undefined;
  const fromProfile = profile?.catalog?.["@id"];
  if (fromProfile) return fromProfile;
  return `${storageRoot}${DEFAULT_CATALOG_FILENAME}`;
}

/**
 * Adds a dataset entry to the catalog via SPARQL PATCH.
 *
 * @remarks
 * Creates the catalog on 404 and retries the operation.
 *
 * @param catalogUri - URI of the catalog resource
 * @param instanceUri - URI identifying this dataset instance
 * @param binaryUri - URI of the actual data file
 * @param classUri - URI of the class this dataset conforms to
 * @param mediaType - MIME type of the distribution
 * @param byteSize - Size of the distribution in bytes
 * @param title - Human-readable title for the dataset
 * @param description - Optional description of the dataset
 * @param modified - ISO 8601 datetime of last modification
 * @param publisherWebId - WebID of the publisher
 * @param fetch - Authenticated fetch function
 *
 * @public
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

  const escapeTurtleLiteral = (literal: string) =>
    literal.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

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
      dcat:distribution <${instanceUri}${DISTRIBUTION_FRAGMENT}> .
    <${instanceUri}${DISTRIBUTION_FRAGMENT}> a dcat:Distribution ;
      dcat:accessURL <${binaryUri}> ;
      dcat:mediaType "${escapeTurtleLiteral(mediaType)}" ;
      dcat:byteSize ${byteSize} .
  }
`.trim();

  let patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.SPARQL_UPDATE },
    body: sparqlUpdate,
  });

  if (!patchResponse.ok && patchResponse.status === 404) {
    const putResponse = await fetch(catalogUri, {
      method: "PUT",
      headers: { "Content-Type": CONTENT_TYPES.TURTLE },
      body: EMPTY_CATALOG_TURTLE,
    });
    if (!putResponse.ok) {
      throw new Error(`Failed to create catalog.ttl: ${putResponse.status} ${putResponse.statusText}`);
    }
    patchResponse = await fetch(catalogUri, {
      method: "PATCH",
      headers: { "Content-Type": CONTENT_TYPES.SPARQL_UPDATE },
      body: sparqlUpdate,
    });
  }

  if (!patchResponse.ok) {
    throw new Error(`Failed to update catalog.ttl: ${patchResponse.status} ${patchResponse.statusText}`);
  }
}

/**
 * Removes a dataset and its distribution from the catalog.
 *
 * @remarks
 * No-ops silently if the catalog isn't reachable.
 *
 * @param catalogUri - URI of the catalog resource
 * @param instanceUri - URI of the dataset to remove
 * @param fetch - Authenticated fetch function
 *
 * @public
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
  DELETE WHERE { <${instanceUri}${DISTRIBUTION_FRAGMENT}> ?p ?v . }
`.trim();

  const patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.SPARQL_UPDATE },
    body: sparqlUpdate,
  });
  if (!patchResponse.ok) {
    throw new Error(`Failed to remove entry from catalog.ttl: ${patchResponse.status} ${patchResponse.statusText}`);
  }
}

/**
 * Parses DCAT catalog entries from Turtle text.
 *
 * @remarks
 * Uses N3 parser to extract dataset metadata and distribution details.
 *
 * @param turtleText - Raw Turtle content of the catalog
 * @param baseUri - Optional base URI for resolving relative IRIs
 * @returns Array of parsed catalog entries
 *
 * @public
 */
export function parseCatalog(turtleText: string, baseUri?: string): CatalogEntry[] {
  let quads;
  try {
    quads = new N3Parser(baseUri ? { baseIRI: baseUri } : undefined).parse(turtleText);
  } catch {
    return [];
  }

  const store = new N3Store(quads);
  const DCAT = RDF_NAMESPACES.DCAT;
  const DCTERMS = RDF_NAMESPACES.DCTERMS;

  const datasetUris = store.getObjects(null, `${DCAT}dataset`, null).map((term) => term.value);

  const queryFirstValue = (subject: string, predicate: string) =>
    store.getObjects(subject, predicate, null)[0]?.value ?? "";

  return datasetUris.map((datasetUri) => {
    const distUri = queryFirstValue(datasetUri, `${DCAT}distribution`);
    return {
      uri: datasetUri,
      conformsTo: queryFirstValue(datasetUri, `${DCTERMS}conformsTo`),
      title: queryFirstValue(datasetUri, `${DCTERMS}title`),
      description: queryFirstValue(datasetUri, `${DCTERMS}description`),
      modified: queryFirstValue(datasetUri, `${DCTERMS}modified`),
      publisher: queryFirstValue(datasetUri, `${DCTERMS}publisher`),
      mediaType: queryFirstValue(distUri, `${DCAT}mediaType`),
      byteSize: parseInt(queryFirstValue(distUri, `${DCAT}byteSize`) || "0", 10),
      accessURL: queryFirstValue(distUri, `${DCAT}accessURL`),
    };
  });
}

/**
 * Links a catalog to the user's profile via `dcat:catalog`.
 *
 * @param catalogUri - URI of the catalog to link
 * @param webId - User's WebID
 * @param fetch - Authenticated fetch function
 *
 * @public
 */
export async function linkCatalogToProfile(
  catalogUri: string,
  webId: string,
  fetch: FetchFn
): Promise<void> {
  assertSafeUri(catalogUri);
  const profileDocUri = webId.split("#")[0];

  const sparqlUpdate = `PREFIX dcat: <${RDF_NAMESPACES.DCAT}>

INSERT DATA {
  <${profileDocUri}> dcat:catalog <${catalogUri}> .
}`.trim();

  const response = await fetch(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.SPARQL_UPDATE },
    body: sparqlUpdate,
  });
  if (!response.ok) {
    throw new Error(`Failed to link catalog to profile: ${response.status} ${response.statusText}`);
  }
}
