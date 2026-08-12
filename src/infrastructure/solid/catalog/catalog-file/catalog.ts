/**
 * DCAT catalog operations for Solid pods.
 *
 * @packageDocumentation
 * Provides CRUD operations for DCAT catalogs stored as Turtle documents.
 *
 * @remarks
 * Catalog mutations use a GET/PUT round trip: the document is loaded into
 * an N3 store, updated in memory, and written back in full. This avoids
 * relying on SPARQL Update support, which varies across Solid servers.
 * 
 */

import { Parser as N3Parser, Store as N3Store, DataFactory } from "n3";
import type { FetchFn, CatalogEntry } from "@/types";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";
import { isSharedCatalogFile } from "@/infrastructure/solid/sharedCatalog";
import { serializeTurtle } from "@/infrastructure/solid/rdfUtils";
import {
  DEFAULT_CATALOG_FILENAME,
  RDF_NAMESPACES,
  RDF_TYPE_URI,
  CONTENT_TYPES,
  SYSTEM_FILES,
} from "@/config";

const { namedNode, literal, quad } = DataFactory;

const DISTRIBUTION_FRAGMENT = "#dist";

const CATALOG_PREFIXES = {
  dcat: RDF_NAMESPACES.DCAT,
  dcterms: RDF_NAMESPACES.DCTERMS,
  xsd: RDF_NAMESPACES.XSD,
};

const RDF_TYPE = namedNode(RDF_TYPE_URI);
const DCAT_CATALOG_CLASS = namedNode(`${RDF_NAMESPACES.DCAT}Catalog`);
const DCAT_DATASET = namedNode(`${RDF_NAMESPACES.DCAT}dataset`);
const DCAT_DATASET_CLASS = namedNode(`${RDF_NAMESPACES.DCAT}Dataset`);
const DCAT_DISTRIBUTION = namedNode(`${RDF_NAMESPACES.DCAT}distribution`);
const DCAT_DISTRIBUTION_CLASS = namedNode(`${RDF_NAMESPACES.DCAT}Distribution`);
const DCAT_ACCESS_URL = namedNode(`${RDF_NAMESPACES.DCAT}accessURL`);
const DCAT_MEDIA_TYPE = namedNode(`${RDF_NAMESPACES.DCAT}mediaType`);
const DCAT_BYTE_SIZE = namedNode(`${RDF_NAMESPACES.DCAT}byteSize`);
const DCTERMS_CONFORMS_TO = namedNode(`${RDF_NAMESPACES.DCTERMS}conformsTo`);
const DCTERMS_TITLE = namedNode(`${RDF_NAMESPACES.DCTERMS}title`);
const DCTERMS_DESCRIPTION = namedNode(`${RDF_NAMESPACES.DCTERMS}description`);
const DCTERMS_MODIFIED = namedNode(`${RDF_NAMESPACES.DCTERMS}modified`);
const DCTERMS_PUBLISHER = namedNode(`${RDF_NAMESPACES.DCTERMS}publisher`);
const XSD_DATE_TIME = namedNode(`${RDF_NAMESPACES.XSD}dateTime`);
const XSD_INTEGER = namedNode(`${RDF_NAMESPACES.XSD}integer`);

function assertSafeUri(uri: string): void {
  if (/[>\s]/.test(uri)) throw new Error(`Unsafe URI rejected for SPARQL interpolation: "${uri}"`);
}

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
 * Reads a Turtle document into an N3 store, mutates it, and PUTs the whole
 * document back. A 404 GET starts from an empty store, so this doubles as
 * "create the catalog if it doesn't exist yet".
 *
 * @internal
 */
async function withCatalogStore(
  catalogUri: string,
  fetch: FetchFn,
  mutate: (store: N3Store) => void
): Promise<void> {
  const getResponse = await fetch(catalogUri);
  if (!getResponse.ok && getResponse.status !== 404) {
    throw new Error(`Failed to read ${catalogUri}: ${getResponse.status} ${getResponse.statusText}`);
  }

  const isNewCatalog = getResponse.status === 404;
  const quads = isNewCatalog ? [] : new N3Parser({ baseIRI: catalogUri }).parse(await getResponse.text());
  const store = new N3Store(quads);
  if (isNewCatalog) {
    store.addQuad(quad(namedNode(catalogUri), RDF_TYPE, DCAT_CATALOG_CLASS));
  }

  mutate(store);

  const turtle = serializeTurtle(store.getQuads(null, null, null, null), CATALOG_PREFIXES);
  const putResponse = await fetch(catalogUri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: turtle,
  });
  if (!putResponse.ok) {
    throw new Error(`Failed to write ${catalogUri}: ${putResponse.status} ${putResponse.statusText}`);
  }
}

/**
 * Adds a dataset entry to the catalog.
 *
 * @param catalogUri - URI of the catalog resource
 * @param instanceUri - URI identifying this dataset instance
 * @param binaryUri - URI of the actual data file
 * @param classUri - URI of the class this dataset conforms to
 * @param mediaType - MIME type of the distribution
 * @param byteSize - Size of the distribution in bytes
 * @param title -  title for the dataset
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
  await withCatalogStore(catalogUri, fetch, (store) => {
    const catalog = namedNode(catalogUri);
    const instance = namedNode(instanceUri);
    const distribution = namedNode(`${instanceUri}${DISTRIBUTION_FRAGMENT}`);

    store.addQuad(quad(catalog, DCAT_DATASET, instance));
    store.addQuad(quad(instance, RDF_TYPE, DCAT_DATASET_CLASS));
    store.addQuad(quad(instance, DCTERMS_CONFORMS_TO, namedNode(classUri)));
    store.addQuad(quad(instance, DCTERMS_TITLE, literal(title)));
    if (description.trim()) {
      store.addQuad(quad(instance, DCTERMS_DESCRIPTION, literal(description)));
    }
    store.addQuad(quad(instance, DCTERMS_MODIFIED, literal(modified, XSD_DATE_TIME)));
    store.addQuad(quad(instance, DCTERMS_PUBLISHER, namedNode(publisherWebId)));
    store.addQuad(quad(instance, DCAT_DISTRIBUTION, distribution));
    store.addQuad(quad(distribution, RDF_TYPE, DCAT_DISTRIBUTION_CLASS));
    store.addQuad(quad(distribution, DCAT_ACCESS_URL, namedNode(binaryUri)));
    store.addQuad(quad(distribution, DCAT_MEDIA_TYPE, literal(mediaType)));
    store.addQuad(quad(distribution, DCAT_BYTE_SIZE, literal(String(byteSize), XSD_INTEGER)));
  });
}

/**
 *  Removes a dataset and its distribution metadata from a DCAT catalog.
 *
 * @remarks
 * Returns without modification when the catalog is unavailable. The catalog
 * is updated through a single GET/PUT cycle, so all related triples are
 * removed together.
 *
 * @param catalogUri - URI of the catalog resource.
 * @param instanceUri - URI of the dataset to remove.
 * @param fetch - Authenticated Solid fetch function.
 *
 * @public
 */
export async function removeFromCatalog(
  catalogUri: string,
  instanceUri: string,
  fetch: FetchFn
): Promise<void> {
  const headResponse = await fetch(catalogUri, { method: "HEAD" });
  if (!headResponse.ok) return;

  await withCatalogStore(catalogUri, fetch, (store) => {
    const catalog = namedNode(catalogUri);
    const instance = namedNode(instanceUri);
    const distribution = namedNode(`${instanceUri}${DISTRIBUTION_FRAGMENT}`);

    store.removeQuads(store.getQuads(catalog, DCAT_DATASET, instance, null));
    store.removeQuads(store.getQuads(instance, null, null, null));
    store.removeQuads(store.getQuads(distribution, null, null, null));
  });
}

/**
 * Returns a URI's resource filename, decoding percent-escapes when the
 * tail is well-formed and falling back to the raw tail otherwise.
 *
 * @public
 */
export function resourceFileName(uri: string): string {
  const tail = uri.split("/").pop() ?? "";
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

/**
 * True when a dataset URI points at a user file rather than an internal
 * bookkeeping resource (the catalog itself, ACL/meta files, or a
 * per-contact shared catalog). Keeps internal `.shared-*.ttl` and system
 * files from ever surfacing as catalog entries in any view.
 *
 * @internal
 */
function isUserVisibleDatasetUri(uri: string): boolean {
  const fileName = resourceFileName(uri);
  return !SYSTEM_FILES.has(fileName) && !isSharedCatalogFile(fileName);
}

/**
 * Normalizes a `dcterms:conformsTo` value to a usable class URI. A real
 * type is a vocabulary term, never a pod resource, so a value that points
 * at a `.ttl` file (a stray catalog, ACL, or shared-catalog reference) is
 * not a type and is dropped to "" so the entry falls back to its default
 * type instead of producing a junk filter chip.
 *
 * @internal
 */
function sanitizeClassUri(uri: string): string {
  if (!uri) return "";
  const fileName = resourceFileName(uri);
  if (fileName.endsWith(".ttl") || SYSTEM_FILES.has(fileName) || isSharedCatalogFile(fileName)) {
    return "";
  }
  return uri;
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

  const datasetUris = store
    .getObjects(null, `${DCAT}dataset`, null)
    .map((term) => term.value)
    .filter(isUserVisibleDatasetUri);

  const queryFirstValue = (subject: string, predicate: string) =>
    store.getObjects(subject, predicate, null)[0]?.value ?? "";

  return datasetUris.map((datasetUri) => {
    const distUri = queryFirstValue(datasetUri, `${DCAT}distribution`);
    return {
      uri: datasetUri,
      conformsTo: sanitizeClassUri(queryFirstValue(datasetUri, `${DCTERMS}conformsTo`)),
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
 * @remarks
 * A single-triple SPARQL PATCH rather than the GET/PUT round-trip used
 * elsewhere in this module: the WebID profile document is a shared,
 * ecosystem-wide resource that other apps also write to, so a surgical
 * one-triple insert is safer than reading, rewriting, and putting back
 * the whole document.
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
  const profileDocUri = webId.split("#")[0];
  assertSafeUri(catalogUri);
  assertSafeUri(profileDocUri);

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
