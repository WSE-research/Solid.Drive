/**
 * @packageDocumentation
 * Tests `buildN3Patch`: 
 * the emitted patch is a `solid:InsertDeletePatch`, it
 * declares its prefixes, and it carries every DCAT triple with correct
 * literal escaping.
 *
 * The last block is a durable guard: it asserts the patch inserts the
 * identical quad set the shipped `appendToCatalog` writes via GET+PUT, so any
 * drift in the app's triples (like the `sd:hasParent` addition) fails here.
 */

import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { buildN3Patch, type CatalogAppend } from "./buildN3Patch";
import { sortedQuadKeys } from "./quadKey";
import { catalogFetchStub } from "./catalogFetchStub";
import { RDF_TYPE, DISTRIBUTION_FRAGMENT } from "./rdfNamespaces";
import { RDF_NAMESPACES } from "@/config";
import { appendToCatalog } from "@/infrastructure/solid/catalog";

const base: CatalogAppend = {
  catalogUri: "https://pod.example/catalog.ttl",
  instanceUri: "https://pod.example/photos/cat/",
  binaryUri: "https://pod.example/photos/cat/cat.png",
  classUri: "https://schema.org/ImageObject",
  mediaType: "image/png",
  byteSize: 2048,
  title: "Cat",
  description: "A cat photo",
  modified: "2026-08-25T10:00:00.000Z",
  publisherWebId: "https://pod.example/profile/card#me",
  parentUri: "https://pod.example/photos/",
};

const distribution = `${base.instanceUri}${DISTRIBUTION_FRAGMENT}`;

describe("buildN3Patch", () => {
  it("wraps the triples in a solid:InsertDeletePatch inserts block", () => {
    const patch = buildN3Patch(base);
    expect(patch).toContain("a solid:InsertDeletePatch");
    expect(patch).toContain("solid:inserts {");
  });

  it("declares every prefix it uses, sourced from the app's namespaces", () => {
    const patch = buildN3Patch(base);
    expect(patch).toContain("@prefix solid: <http://www.w3.org/ns/solid/terms#> .");
    expect(patch).toContain(`@prefix dcat: <${RDF_NAMESPACES.DCAT}> .`);
    expect(patch).toContain(`@prefix dcterms: <${RDF_NAMESPACES.DCTERMS}> .`);
    expect(patch).toContain(`@prefix xsd: <${RDF_NAMESPACES.XSD}> .`);
    expect(patch).toContain(`@prefix sd: <${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}> .`);
  });

  it("inserts the catalog to dataset link and the dataset type", () => {
    const patch = buildN3Patch(base);
    expect(patch).toContain(`<${base.catalogUri}> dcat:dataset <${base.instanceUri}> .`);
    expect(patch).toContain(`<${base.instanceUri}> a dcat:Dataset .`);
  });

  it("inserts every dataset metadata triple appendToCatalog would write", () => {
    const patch = buildN3Patch(base);
    expect(patch).toContain(`<${base.instanceUri}> dcterms:conformsTo <${base.classUri}> .`);
    expect(patch).toContain(`<${base.instanceUri}> dcterms:title "Cat" .`);
    expect(patch).toContain(`<${base.instanceUri}> dcterms:description "A cat photo" .`);
    expect(patch).toContain(`<${base.instanceUri}> dcterms:modified "2026-08-25T10:00:00.000Z"^^xsd:dateTime .`);
    expect(patch).toContain(`<${base.instanceUri}> dcterms:publisher <${base.publisherWebId}> .`);
    expect(patch).toContain(`<${base.instanceUri}> dcat:distribution <${distribution}> .`);
  });

  it("inserts the distribution triples with a typed byteSize", () => {
    const patch = buildN3Patch(base);
    expect(patch).toContain(`<${distribution}> a dcat:Distribution .`);
    expect(patch).toContain(`<${distribution}> dcat:accessURL <${base.binaryUri}> .`);
    expect(patch).toContain(`<${distribution}> dcat:mediaType "image/png" .`);
    expect(patch).toContain(`<${distribution}> dcat:byteSize "2048"^^xsd:integer .`);
  });

  it("inserts sd:hasParent when parentUri is set", () => {
    const patch = buildN3Patch(base);
    expect(patch).toContain(`<${base.instanceUri}> sd:hasParent <${base.parentUri}> .`);
  });

  it("omits sd:hasParent when parentUri is absent or empty", () => {
    expect(buildN3Patch({ ...base, parentUri: undefined })).not.toContain("sd:hasParent");
    expect(buildN3Patch({ ...base, parentUri: "" })).not.toContain("sd:hasParent");
  });

  it("omits dcterms:description when the description is blank", () => {
    const patch = buildN3Patch({ ...base, description: "   " });
    expect(patch).not.toContain("dcterms:description");
  });

  it("escapes quotes, backslashes and newlines in literals", () => {
    const patch = buildN3Patch({ ...base, title: 'a "quote"\\ and\nnewline' });
    expect(patch).toContain(`dcterms:title "a \\"quote\\"\\\\ and\\nnewline" .`);
  });

  it("rejects URIs that would break out of the angle brackets", () => {
    expect(() => buildN3Patch({ ...base, instanceUri: "https://pod.example/ evil>" })).toThrow();
  });
});

// Durable guard: this block fails as soon as buildN3Patch's inserts drift
// from what the shipped appendToCatalog actually writes.

// appendToCatalog's PUT body includes the catalog's own `a dcat:Catalog`
// triple, which predates the append and isn't something buildN3Patch inserts.
const DCAT_CATALOG = `${RDF_NAMESPACES.DCAT}Catalog`;

/** Captures the whole-document PUT body the real appendToCatalog writes over an existing empty catalog. */
async function realAppendPutBody(entry: CatalogAppend): Promise<string> {
  const stub = catalogFetchStub(entry.catalogUri);
  const fetch = stub.fetch as unknown as Parameters<typeof appendToCatalog>[0]["fetch"];
  await appendToCatalog({ ...entry, parentUri: entry.parentUri ?? "", fetch });
  return stub.writtenBody();
}

// Parses the patch's solid:inserts block into quads for comparison.
function patchInsertQuads(entry: CatalogAppend) {
  const patch = buildN3Patch(entry);
  const prefixes = patch.slice(0, patch.indexOf("_:patch"));
  const inner = patch.slice(patch.indexOf("{") + 1, patch.lastIndexOf("}"));
  return new Parser({ baseIRI: entry.catalogUri }).parse(`${prefixes}\n${inner}`);
}

// Asserts that buildN3Patch and the real appendToCatalog insert the same quad set for the given entry.
async function expectEquivalentInserts(entry: CatalogAppend): Promise<void> {
  const putBody = await realAppendPutBody(entry);
  const realQuads = new Parser({ baseIRI: entry.catalogUri })
    .parse(putBody)
    .filter((quad) => !(quad.subject.value === entry.catalogUri && quad.predicate.value === RDF_TYPE && quad.object.value === DCAT_CATALOG));

  expect(sortedQuadKeys(realQuads)).toEqual(sortedQuadKeys(patchInsertQuads(entry)));
}

describe("buildN3Patch <-> appendToCatalog equivalence", () => {
  it("inserts exactly the quads the shipped appendToCatalog writes (with parent)", () =>
    expectEquivalentInserts(base));

  it("stays equivalent when there is no parent and no description", () =>
    expectEquivalentInserts({ ...base, parentUri: "", description: "" }));
});
