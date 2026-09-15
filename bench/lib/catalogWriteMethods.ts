/**
 * @packageDocumentation
 * The two ways to add one entry to a catalog, the pair the write-method
 * experiment compares. A catalog is a Turtle document listing everything in a
 * pod; both methods write the same entry, and only *how* they write it differs.
 *
 * `putAppend` is what the application ships: GET the whole catalog, add the
 * entry, PUT the whole document back. The full document crosses the wire on
 * every update, so its cost grows with the catalog.
 *
 * `patchAppend` sends only the insert, as a small N3 Patch. The client never
 * downloads or re-uploads the catalog, so the bytes it sends and the memory it
 * holds stay flat however large the catalog grows. Latency does not: the server
 * still applies the patch by reading the whole catalog and writing it back, so
 * the request slows down with catalog size all the same. The saving is on the
 * wire and in client memory, not in server time.
 *
 * `addEntryQuads` builds the entry's triples for the PUT method, kept identical
 * to what the application writes in `catalog.ts`, so the write method stays the
 * only variable. `catalogWriteMethods.test.ts` checks `putAppend` against the
 * real `appendToCatalog`, so a drift there (the missing `a sd:File` it caught)
 * fails.
 */

import { Parser, Store, Writer, DataFactory } from "n3";
import { buildN3Patch, type CatalogAppend } from "./buildN3Patch";
import type { AuthFetch } from "./auth";
import {
  DCAT_NS as DCAT, DCTERMS_NS as DCTERMS, XSD_NS as XSD, SD_NS as SD,
  RDF_TYPE, DISTRIBUTION_FRAGMENT,
} from "./rdfNamespaces";

const { namedNode, literal, quad } = DataFactory;

// Adds the twelve DCAT triples that represent a catalog entry.
function addEntryQuads(store: Store, catalogUri: string, entry: CatalogAppend): void {
  const catalog = namedNode(catalogUri);
  const instance = namedNode(entry.instanceUri);
  const distribution = namedNode(`${entry.instanceUri}${DISTRIBUTION_FRAGMENT}`);

  store.addQuad(quad(catalog, namedNode(`${DCAT}dataset`), instance));
  store.addQuad(quad(instance, namedNode(RDF_TYPE), namedNode(`${DCAT}Dataset`)));
  store.addQuad(quad(instance, namedNode(RDF_TYPE), namedNode(`${SD}File`)));
  store.addQuad(quad(instance, namedNode(`${DCTERMS}conformsTo`), namedNode(entry.classUri)));
  store.addQuad(quad(instance, namedNode(`${DCTERMS}title`), literal(entry.title)));
  if (entry.description.trim()) {
    store.addQuad(quad(instance, namedNode(`${DCTERMS}description`), literal(entry.description)));
  }
  store.addQuad(quad(instance, namedNode(`${DCTERMS}modified`), literal(entry.modified, namedNode(`${XSD}dateTime`))));
  store.addQuad(quad(instance, namedNode(`${DCTERMS}publisher`), namedNode(entry.publisherWebId)));
  if (entry.parentUri) {
    store.addQuad(quad(instance, namedNode(`${SD}hasParent`), namedNode(entry.parentUri)));
  }
  store.addQuad(quad(instance, namedNode(`${DCAT}distribution`), distribution));
  store.addQuad(quad(distribution, namedNode(RDF_TYPE), namedNode(`${DCAT}Distribution`)));
  store.addQuad(quad(distribution, namedNode(`${DCAT}accessURL`), namedNode(entry.binaryUri)));
  store.addQuad(quad(distribution, namedNode(`${DCAT}mediaType`), literal(entry.mediaType)));
  store.addQuad(quad(distribution, namedNode(`${DCAT}byteSize`), literal(String(entry.byteSize), namedNode(`${XSD}integer`))));
}

function serialize(store: Store): Promise<string> {
  const writer = new Writer({ prefixes: { dcat: DCAT, dcterms: DCTERMS, xsd: XSD } });
  writer.addQuads(store.getQuads(null, null, null, null));
  return new Promise((resolve, reject) => writer.end((error, result) => (error ? reject(error) : resolve(result))));
}

/**
 * PUT method: 
 *  - GET the whole catalog, 
 *  - add the entry, 
 *  - PUT the whole document back.
 * 
 * A 404 GET starts from an empty typed catalog (create-if-absent).
 */
export async function putAppend(authFetch: AuthFetch, catalogUri: string, entry: CatalogAppend): Promise<void> {
  const getResponse = await authFetch(catalogUri);
  if (!getResponse.ok && getResponse.status !== 404) {
    throw new Error(`GET ${catalogUri} -> ${getResponse.status}`);
  }
  const isNew = getResponse.status === 404;
  const quads = isNew ? [] : new Parser({ baseIRI: catalogUri }).parse(await getResponse.text());
  const store = new Store(quads);
  if (isNew) store.addQuad(quad(namedNode(catalogUri), namedNode(RDF_TYPE), namedNode(`${DCAT}Catalog`)));
  addEntryQuads(store, catalogUri, entry);

  const body = await serialize(store);
  const putResponse = await authFetch(catalogUri, { method: "PUT", headers: { "content-type": "text/turtle" }, body });
  if (!putResponse.ok) throw new Error(`PUT ${catalogUri} -> ${putResponse.status}`);
}

// PATCH method: send only the new triples, as a small PATCH request in the N3 Patch format.
export async function patchAppend(authFetch: AuthFetch, catalogUri: string, entry: CatalogAppend): Promise<void> {
  const response = await authFetch(catalogUri, {
    method: "PATCH",
    headers: { "content-type": "text/n3" },
    body: buildN3Patch(entry),
  });
  if (!response.ok) throw new Error(`PATCH ${catalogUri} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
}

// Creates `count` catalog entries with a single PUT outside the measurement.
export async function seedCatalog(
  authFetch: AuthFetch,
  catalogUri: string,
  count: number,
  makeEntry: (index: number) => CatalogAppend,
): Promise<void> {
  const store = new Store();
  store.addQuad(quad(namedNode(catalogUri), namedNode(RDF_TYPE), namedNode(`${DCAT}Catalog`)));
  for (let index = 0; index < count; index++) addEntryQuads(store, catalogUri, makeEntry(index));

  const body = await serialize(store);
  const response = await authFetch(catalogUri, { method: "PUT", headers: { "content-type": "text/turtle" }, body });
  if (!response.ok) throw new Error(`seed PUT ${catalogUri} -> ${response.status}`);
}
