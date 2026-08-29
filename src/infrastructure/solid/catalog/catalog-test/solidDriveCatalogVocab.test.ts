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
const STORAGE_OBJECT_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}StorageObject`;
const FOLDER_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}Folder`;
const FILE_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}File`;
const HAS_PARENT_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}hasParent`;
const DELETED_AT_URI = `${RDF_NAMESPACES.SOLID_DRIVE_CATALOG}deletedAt`;
const OWL_DISJOINT_WITH = "http://www.w3.org/2002/07/owl#disjointWith";

describe("solid-drive-catalog.ttl", () => {
  const turtle = readFileSync(VOCAB_PATH, "utf-8");
  const store = new N3Store(new N3Parser().parse(turtle));

  it("parses as a valid Turtle", () => {
    expect(store.size).toBeGreaterThan(0);
  });

  it("defines StorageObject as a dataset, the base type both File and Folder inherit from", () => {
    expect(store.countQuads(STORAGE_OBJECT_URI, RDFS_SUBCLASS_OF, `${RDF_NAMESPACES.DCAT}Dataset`, null)).toBe(1);
  });

  it("counts a Folder as both a StorageObject and a real Pod container", () => {
    expect(store.countQuads(FOLDER_URI, RDFS_SUBCLASS_OF, STORAGE_OBJECT_URI, null)).toBe(1);
    expect(store.countQuads(FOLDER_URI, RDFS_SUBCLASS_OF, `${RDF_NAMESPACES.LDP}Container`, null)).toBe(1);
  });

  it("counts a File as a StorageObject too, but not as a Pod container the way Folder is", () => {
    expect(store.countQuads(FILE_URI, RDFS_SUBCLASS_OF, STORAGE_OBJECT_URI, null)).toBe(1);
    expect(store.countQuads(FILE_URI, RDFS_SUBCLASS_OF, `${RDF_NAMESPACES.LDP}Container`, null)).toBe(0);
  });

  it("keeps Folder and File mutually exclusive, so an entry can never be both at once", () => {
    const disjointBothWays =
      store.countQuads(FOLDER_URI, OWL_DISJOINT_WITH, FILE_URI, null) +
      store.countQuads(FILE_URI, OWL_DISJOINT_WITH, FOLDER_URI, null);
    expect(disjointBothWays).toBe(1);
  });

  it("builds hasParent on top of Dublin Core's standard 'is part of' relationship", () => {
    expect(
      store.countQuads(HAS_PARENT_URI, RDFS_SUBPROPERTY_OF, `${RDF_NAMESPACES.DCTERMS}isPartOf`, null)
    ).toBe(1);
  });

  it("restricts hasParent to files and folders, and only lets it point at a folder", () => {
    expect(store.countQuads(HAS_PARENT_URI, RDFS_DOMAIN, STORAGE_OBJECT_URI, null)).toBe(1);
    expect(store.countQuads(HAS_PARENT_URI, RDFS_RANGE, FOLDER_URI, null)).toBe(1);
  });

  it("restricts deletedAt to files and folders, with a date and time as its value", () => {
    expect(store.countQuads(DELETED_AT_URI, RDFS_DOMAIN, STORAGE_OBJECT_URI, null)).toBe(1);
    expect(store.countQuads(DELETED_AT_URI, RDFS_RANGE, `${RDF_NAMESPACES.XSD}dateTime`, null)).toBe(1);
  });

  it("gives every term in the vocabulary a proper type, either a class or a property", () => {
    expect(store.getQuads(STORAGE_OBJECT_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
    expect(store.getQuads(FOLDER_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
    expect(store.getQuads(FILE_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
    expect(store.getQuads(HAS_PARENT_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
    expect(store.getQuads(DELETED_AT_URI, RDF_TYPE_URI, null, null).length).toBeGreaterThan(0);
  });

  it("lets hasParent and deletedAt each hold at most one value per entry", () => {
    expect(store.countQuads(HAS_PARENT_URI, RDF_TYPE_URI, OWL_FUNCTIONAL_PROPERTY, null)).toBe(1);
    expect(store.countQuads(DELETED_AT_URI, RDF_TYPE_URI, OWL_FUNCTIONAL_PROPERTY, null)).toBe(1);
  });

  it("uses its own short prefix, sdcat, kept separate from an unrelated prefix this project already uses elsewhere for file metadata", () => {
    const prefix = store.getObjects(ONTOLOGY_URI, VANN_PREFERRED_PREFIX, null)[0]?.value;
    const uri = store.getObjects(ONTOLOGY_URI, VANN_PREFERRED_URI, null)[0]?.value;
    expect(prefix).toBe("sdcat");
    expect(uri).toBe(RDF_NAMESPACES.SOLID_DRIVE_CATALOG);
  });

  it("is licensed under CC-BY 4.0, kept separate from the MIT license covering this repo's code", () => {
    const licenseUri = "http://purl.org/dc/terms/license";
    expect(store.getObjects(ONTOLOGY_URI, licenseUri, null)[0]?.value).toBe(
      "https://creativecommons.org/licenses/by/4.0/"
    );
  });

  it("carries a version number and a versioned link, so a reader can cite the exact revision they used", () => {
    expect(store.getObjects(ONTOLOGY_URI, "http://www.w3.org/2002/07/owl#versionInfo", null)[0]?.value).toBe(
      "1.1.0"
    );
    expect(
      store.getObjects(ONTOLOGY_URI, "http://www.w3.org/2002/07/owl#versionIRI", null)[0]?.value
    ).toBe("https://purl.org/solid-drive/catalog/1.1.0");
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
    expect(
      store.countQuads(FILE_URI, seeAlso, "http://tracker.api.gnome.org/ontology/v3/nfo#FileDataObject", null)
    ).toBe(1);
    expect(
      store.countQuads(DELETED_AT_URI, seeAlso, "https://www.w3.org/ns/activitystreams#deleted", null)
    ).toBe(1);
    expect(
      store.countQuads(DELETED_AT_URI, seeAlso, "https://specifications.freedesktop.org/trash-spec/latest/", null)
    ).toBe(1);
  });
});
