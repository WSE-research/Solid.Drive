/**
 * Reads and writes DCAT catalogs stored as Turtle files: SPARQL UPDATE to
 * change them, N3 to parse them.
 *
 * @packageDocumentation
 */

import { Parser as N3Parser, Store as N3Store } from "n3";
import type { FetchFn, CatalogEntry } from "@/types";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";
import { isSharedCatalogFile } from "@/infrastructure/solid/sharedCatalog";
import {
  DEFAULT_CATALOG_FILENAME,
  RDF_NAMESPACES,
  CONTENT_TYPES,
  SYSTEM_FILES,
} from "@/config";

/**
 * Throws if `uri` contains `>` or whitespace, either of which could break
 * an angle-bracket IRI token in a SPARQL or Turtle string.
 *
 * @param uri - The URI to validate
 * @throws Error if the URI contains unsafe characters
 *
 * @internal
 */
function assertSafeUri(uri: string): void {
  if (/[>\s]/.test(uri)) throw new Error(`Unsafe URI rejected for SPARQL interpolation: "${uri}"`);
}

/**
 * Escapes a string for safe interpolation into a Turtle string literal.
 *
 * @internal
 */
function escapeTurtleLiteral(literal: string): string {
  return literal.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

const DISTRIBUTION_FRAGMENT = "#dist";

const CATALOG_SPARQL_PREFIXES = `
PREFIX dcat: <${RDF_NAMESPACES.DCAT}>
PREFIX dcterms: <${RDF_NAMESPACES.DCTERMS}>
PREFIX xsd: <${RDF_NAMESPACES.XSD}>
PREFIX sd: <${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}>
`.trim();

/**
 * Turtle for a new, empty catalog. Declares an explicit `@base` so the
 * document identifies itself even when read outside its own retrieval
 * context (copied, cached, or parsed without a baseUri).
 *
 * @param catalogUri - The catalog's own URI, used as its base address
 *
 * @public
 */
export function buildEmptyCatalogTurtle(catalogUri: string): string {
  return `@base <${catalogUri}> .
@prefix dcat: <${RDF_NAMESPACES.DCAT}> .

<> a dcat:Catalog .
`;
}

/**
 * Marks a catalog entry as a folder, using this project's own vocabulary.
 *
 * @public
 */
export const FOLDER_CLASS_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}Folder`;

/**
 * Marks a catalog entry as a file, using this project's own vocabulary.
 * Nothing routes on it the way {@link FOLDER_CLASS_URI} does, since every
 * non-folder entry is already treated as a file.
 *
 * @public
 */
export const FILE_CLASS_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}File`;

/**
 * The `dcterms:conformsTo` value folders were marked with before this
 * project had its own vocabulary. Catalogs written by earlier versions of
 * this app still use it; {@link isFolderEntry} treats both as folders.
 *
 * @public
 */
export const LEGACY_FOLDER_CLASS_URI = `${RDF_NAMESPACES.LDP}Container`;

/**
 * True when a catalog entry represents a folder, whether it was written
 * with the current {@link FOLDER_CLASS_URI} or the
 * {@link LEGACY_FOLDER_CLASS_URI} marker used before this vocabulary
 * existed.
 *
 * @public
 */
export function isFolderEntry(entry: CatalogEntry): boolean {
  return entry.conformsTo === FOLDER_CLASS_URI || entry.conformsTo === LEGACY_FOLDER_CLASS_URI;
}

/**
 * Applies `sparqlUpdate` to the catalog. If the catalog doesn't exist
 * yet, creates an empty one first and retries.
 *
 * @internal
 */
async function patchCatalog(catalogUri: string, sparqlUpdate: string, fetch: FetchFn): Promise<void> {
  let patchResponse = await fetch(catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.SPARQL_UPDATE },
    body: sparqlUpdate,
  });

  if (!patchResponse.ok && patchResponse.status === 404) {
    const putResponse = await fetch(catalogUri, {
      method: "PUT",
      headers: { "Content-Type": CONTENT_TYPES.TURTLE },
      body: buildEmptyCatalogTurtle(catalogUri),
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
 * Returns a user's catalog URI: the profile-linked catalog (`dcat:catalog`)
 * if there is one, otherwise the default location under the storage root.
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
 * Parameters for {@link appendToCatalog}.
 *
 * @public
 */
export interface AppendFileEntryParams {
  /** URI of the catalog resource */
  catalogUri: string;
  /** URI identifying this dataset instance */
  instanceUri: string;
  /** URI of the actual data file */
  binaryUri: string;
  /** URI of the class this dataset conforms to */
  classUri: string;
  /** URI of the folder this file lives in, empty to omit the link */
  parentUri: string;
  /** MIME type of the distribution */
  mediaType: string;
  /** Size of the distribution in bytes */
  byteSize: number;
  /** Human-readable title for the dataset */
  title: string;
  /** Description of the dataset, empty for none */
  description: string;
  /** ISO 8601 datetime of last modification */
  modified: string;
  /** WebID of the publisher */
  publisherWebId: string;
  /** Authenticated fetch function */
  fetch: FetchFn;
}

/**
 * Adds a dataset entry to the catalog via SPARQL PATCH, creating the
 * catalog first if it doesn't exist yet.
 *
 * @public
 */
export async function appendToCatalog(params: AppendFileEntryParams): Promise<void> {
  const {
    catalogUri, instanceUri, binaryUri, classUri, parentUri,
    mediaType, byteSize, title, description, modified, publisherWebId, fetch,
  } = params;

  assertSafeUri(catalogUri);
  assertSafeUri(instanceUri);
  assertSafeUri(binaryUri);
  assertSafeUri(classUri);
  assertSafeUri(publisherWebId);
  if (parentUri) assertSafeUri(parentUri);

  const descriptionTriple = description.trim()
    ? `\n    dcterms:description "${escapeTurtleLiteral(description)}" ;`
    : "";
  const parentTriple = parentUri ? `\n    sd:hasParent <${parentUri}> ;` : "";

  const sparqlUpdate = `${CATALOG_SPARQL_PREFIXES}

  INSERT DATA {
    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset, sd:File ;
      dcterms:conformsTo <${classUri}> ;
      dcterms:title "${escapeTurtleLiteral(title)}" ;${descriptionTriple}
      dcterms:modified "${modified}"^^xsd:dateTime ;
      dcterms:publisher <${publisherWebId}> ;${parentTriple}
      dcat:distribution <${instanceUri}${DISTRIBUTION_FRAGMENT}> .
    <${instanceUri}${DISTRIBUTION_FRAGMENT}> a dcat:Distribution ;
      dcat:accessURL <${binaryUri}> ;
      dcat:mediaType "${escapeTurtleLiteral(mediaType)}" ;
      dcat:byteSize ${byteSize} .
  }
`.trim();

  await patchCatalog(catalogUri, sparqlUpdate, fetch);
}

/**
 * Parameters for {@link appendFolderToCatalog}.
 *
 * @public
 */
export interface AppendFolderEntryParams {
  /** URI of the catalog resource */
  catalogUri: string;
  /** URI of the folder container this dataset describes */
  folderUri: string;
  /** URI of the folder this folder lives in */
  parentUri: string;
  /** Human-readable title for the folder (the name the user typed) */
  title: string;
  /** ISO 8601 datetime the folder was created */
  modified: string;
  /** WebID of the folder's creator */
  publisherWebId: string;
  /** Authenticated fetch function */
  fetch: FetchFn;
}

/**
 * Adds a folder's dataset entry to the catalog via SPARQL PATCH, creating
 * the catalog first if it doesn't exist yet.
 *
 * @remarks
 * Unlike {@link appendToCatalog}, a folder has no binary to point to, so
 * no `dcat:Distribution` is written. The folder's own URI is used as the
 * dataset URI. The entry carries both `dcterms:conformsTo` (matching how
 * file entries declare their type) and `rdf:type` (real class membership,
 * per the vocabulary's own class modelling).
 *
 * @public
 */
export async function appendFolderToCatalog(params: AppendFolderEntryParams): Promise<void> {
  const { catalogUri, folderUri, parentUri, title, modified, publisherWebId, fetch } = params;

  assertSafeUri(catalogUri);
  assertSafeUri(folderUri);
  assertSafeUri(parentUri);
  assertSafeUri(publisherWebId);

  const sparqlUpdate = `${CATALOG_SPARQL_PREFIXES}

  INSERT DATA {
    <${catalogUri}> dcat:dataset <${folderUri}> .
    <${folderUri}> a dcat:Dataset, sd:Folder ;
      dcterms:conformsTo <${FOLDER_CLASS_URI}> ;
      dcterms:title "${escapeTurtleLiteral(title)}" ;
      dcterms:modified "${modified}"^^xsd:dateTime ;
      dcterms:publisher <${publisherWebId}> ;
      sd:hasParent <${parentUri}> .
  }
`.trim();

  await patchCatalog(catalogUri, sparqlUpdate, fetch);
}

/**
 * Parameters for {@link ensureCatalogRootEntry}.
 *
 * @public
 */
export interface EnsureCatalogRootEntryParams {
  /** URI of the catalog resource */
  catalogUri: string;
  /** URI of the pod's top storage container */
  storageRootUri: string;
  /** WebID of the pod owner */
  publisherWebId: string;
  /** Authenticated fetch function */
  fetch: FetchFn;
}

/**
 * Registers the pod's storage root as its own catalog entry, with no
 * `sd:hasParent` link. This is the terminator every folder path walk
 * reaches.
 *
 * @remarks
 * Safe to call on every app start: the triples never vary for a given
 * pod (no `dcterms:modified`, no title), so re-inserting them is a true
 * no-op under RDF set semantics, not something that needs a
 * read-before-write guard.
 *
 * @public
 */
export async function ensureCatalogRootEntry(params: EnsureCatalogRootEntryParams): Promise<void> {
  const { catalogUri, storageRootUri, publisherWebId, fetch } = params;

  assertSafeUri(catalogUri);
  assertSafeUri(storageRootUri);
  assertSafeUri(publisherWebId);

  const sparqlUpdate = `${CATALOG_SPARQL_PREFIXES}

  INSERT DATA {
    <${catalogUri}> dcat:dataset <${storageRootUri}> .
    <${storageRootUri}> a dcat:Dataset, sd:Folder ;
      dcterms:conformsTo <${FOLDER_CLASS_URI}> ;
      dcterms:publisher <${publisherWebId}> .
  }
`.trim();

  await patchCatalog(catalogUri, sparqlUpdate, fetch);
}

/**
 * Removes a dataset and its distribution from the catalog. Does nothing
 * if the catalog isn't reachable.
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
 * Returns the filename at the end of a URI, decoded if it's valid,
 * otherwise as-is.
 *
 * @internal
 */
function resourceFileName(uri: string): string {
  const tail = uri.split("/").pop() ?? "";
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

/**
 * True when a dataset URI points at a user file, not an internal
 * bookkeeping resource like the catalog itself, an ACL/meta file, or a
 * per-contact shared catalog. Keeps those from ever showing up as
 * catalog entries.
 *
 * @internal
 */
function isUserVisibleDatasetUri(uri: string): boolean {
  const fileName = resourceFileName(uri);
  return !SYSTEM_FILES.has(fileName) && !isSharedCatalogFile(fileName);
}

/**
 * Normalizes a `dcterms:conformsTo` value to a usable class URI. A real
 * type is a vocabulary term, not a pod resource, so a `.ttl` file
 * reference (catalog, ACL, shared-catalog) gets dropped to an empty
 * string instead of becoming a junk filter chip.
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
 * Parses DCAT catalog entries out of Turtle text using the N3 parser.
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
  const HAS_PARENT = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}hasParent`;

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
      parentUri: queryFirstValue(datasetUri, HAS_PARENT),
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
