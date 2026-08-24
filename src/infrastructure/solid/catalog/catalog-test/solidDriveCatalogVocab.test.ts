import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Parser as N3Parser, Store as N3Store } from "n3";
import { RDF_NAMESPACES, RDF_TYPE_URI } from "@/config";

const VOCAB_PATH = resolve(__dirname, "../../../../../public/vocab/solid-drive-catalog.ttl");
const RDFS_SUBCLASS_OF = `${RDF_NAMESPACES.RDFS}subClassOf`;
const RDFS_SUBPROPERTY_OF = `${RDF_NAMESPACES.RDFS}subPropertyOf`;
const RDFS_DOMAIN = `${RDF_NAMESPACES.RDFS}domain`;
const RDFS_RANGE = `${RDF_NAMESPACES.RDFS}range`;
const VANN_PREFERRED_PREFIX = "http://purl.org/vocab/vann/preferredNamespacePrefix";
const VANN_PREFERRED_URI = "http://purl.org/vocab/vann/preferredNamespaceUri";
const OWL_FUNCTIONAL_PROPERTY = "http://www.w3.org/2002/07/owl#FunctionalProperty";
const ONTOLOGY_URI = "https://purl.org/solid-drive/catalog";
const FOLDER_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}Folder`;
const HAS_PARENT_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}hasParent`;

describe("solid-drive-catalog.ttl", () => {
  const turtle = readFileSync(VOCAB_PATH, "utf-8");
  const store = new N3Store(new N3Parser().parse(turtle));

  it("parses as valid Turtle", () => {
    expect(store.size).toBeGreaterThan(0);
  });

  it("defines Folder as a subclass of dcat:Dataset and ldp:Container", () => {
    expect(store.countQuads(FOLDER_URI, RDFS_SUBCLASS_OF, `${RDF_NAMESPACES.DCAT}Dataset`, null)).toBe(1);
    expect(store.countQuads(FOLDER_URI, RDFS_SUBCLASS_OF, `${RDF_NAMESPACES.LDP}Container`, null)).toBe(1);
  });

  it("defines hasParent as a subproperty of dcterms:isPartOf", () => {
    expect(
      store.countQuads(HAS_PARENT_URI, RDFS_SUBPROPERTY_OF, `${RDF_NAMESPACES.DCTERMS}isPartOf`, null)
    ).toBe(1);
  });

  it("scopes hasParent to dcat:Dataset entries pointing at a Folder", () => {
    expect(store.countQuads(HAS_PARENT_URI, RDFS_DOMAIN, `${RDF_NAMESPACES.DCAT}Dataset`, null)).toBe(1);
    expect(store.countQuads(HAS_PARENT_URI, RDFS_RANGE, FOLDER_URI, null)).toBe(1);
  });

  it("gives both terms an rdf:type", () => {
    expect(store.getQuads(FOLDER_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
    expect(store.getQuads(HAS_PARENT_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
  });

  it("marks hasParent as functional, so an entry can point at only one parent", () => {
    expect(store.countQuads(HAS_PARENT_URI, RDF_TYPE_URI, OWL_FUNCTIONAL_PROPERTY, null)).toBe(1);
  });

  it("declares its own preferred prefix, distinct from the file-metadata sd: namespace", () => {
    const prefix = store.getObjects(ONTOLOGY_URI, VANN_PREFERRED_PREFIX, null)[0]?.value;
    const uri = store.getObjects(ONTOLOGY_URI, VANN_PREFERRED_URI, null)[0]?.value;
    expect(prefix).toBe("sdcat");
    expect(uri).toBe(RDF_NAMESPACES.SOLID_DRIVE_CATALOG);
  });

  it("declares a CC-BY 4.0 license, distinct from the repo's MIT code license", () => {
    const licenseUri = "http://purl.org/dc/terms/license";
    expect(store.getObjects(ONTOLOGY_URI, licenseUri, null)[0]?.value).toBe(
      "https://creativecommons.org/licenses/by/4.0/"
    );
  });

  it("has a version identifier and a versioned IRI to cite an exact revision", () => {
    expect(store.getObjects(ONTOLOGY_URI, "http://www.w3.org/2002/07/owl#versionInfo", null)[0]?.value).toBe(
      "1.0.0"
    );
    expect(
      store.getObjects(ONTOLOGY_URI, "http://www.w3.org/2002/07/owl#versionIRI", null)[0]?.value
    ).toBe("https://purl.org/solid-drive/catalog/1.0.0");
  });

  it("points to the closest related terms in other vocabularies without claiming equivalence", () => {
    const seeAlso = `${RDF_NAMESPACES.RDFS}seeAlso`;
    expect(
      store.countQuads(FOLDER_URI, seeAlso, "http://tracker.api.gnome.org/ontology/v3/nfo#Folder", null)
    ).toBe(1);
    expect(store.countQuads(HAS_PARENT_URI, seeAlso, "http://www.w3.org/ns/ldp#contains", null)).toBe(1);
    expect(
      store.countQuads(
        HAS_PARENT_URI,
        seeAlso,
        "http://tracker.api.gnome.org/ontology/v3/nfo#belongsToContainer",
        null
      )
    ).toBe(1);
  });
});
