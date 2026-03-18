import { describe, it, expect } from "vitest";
import { parseCatalog, friendlyLabel } from "../src/catalog";


describe("parseCatalog", () => {
  it("returns empty array for an empty catalog", () => {
    const turtle = `
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <> a dcat:Catalog .
    `;
    expect(parseCatalog(turtle)).toEqual([]);
  });

  it("parses a single entry with a Distribution node", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/photo-jpg/index.ttl";
    const binaryUri = "https://pod.example/my-app/photo-jpg/photo.jpg";

    const turtle = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<> a dcat:Catalog .
<${catalogUri}> dcat:dataset <${instanceUri}> .
<${instanceUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#ImageFile> ;
  dcterms:title "Summer photo" ;
  dcterms:modified "2026-03-16T11:52:13.066Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${instanceUri}#dist> .
<${instanceUri}#dist> a dcat:Distribution ;
  dcat:accessURL <${binaryUri}> ;
  dcat:mediaType "image/jpeg" ;
  dcat:byteSize 4500000 .
    `.trim();

    const entries = parseCatalog(turtle);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      uri: instanceUri,
      conformsTo: "https://w3id.org/solid-drive#ImageFile",
      title: "Summer photo",
      description: "",
      modified: "2026-03-16T11:52:13.066Z",
      publisher: "https://pod.example/profile/card#me",
      mediaType: "image/jpeg",
      byteSize: 4500000,
    });
  });

  it("parses description when present", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/report/index.ttl";
    const binaryUri = "https://pod.example/my-app/report/report.pdf";

    const turtle = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<${catalogUri}> dcat:dataset <${instanceUri}> .
<${instanceUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#TextDocument> ;
  dcterms:title "Q1 Report" ;
  dcterms:description "Quarterly financial summary" ;
  dcterms:modified "2026-03-01T00:00:00.000Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${instanceUri}#dist> .
<${instanceUri}#dist> a dcat:Distribution ;
  dcat:accessURL <${binaryUri}> ;
  dcat:mediaType "application/pdf" ;
  dcat:byteSize 512000 .
    `.trim();

    const entries = parseCatalog(turtle);
    expect(entries[0].description).toBe("Quarterly financial summary");
  });

  it("parses multiple entries", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const imageUri = "https://pod.example/my-app/photo-jpg/index.ttl";
    const docUri = "https://pod.example/my-app/report-pdf/index.ttl";

    const turtle = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<> a dcat:Catalog .
<${catalogUri}> dcat:dataset <${imageUri}> .
<${catalogUri}> dcat:dataset <${docUri}> .
<${imageUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#ImageFile> ;
  dcterms:title "Photo" ;
  dcterms:modified "2026-03-10T09:00:00.000Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${imageUri}#dist> .
<${imageUri}#dist> a dcat:Distribution ;
  dcat:accessURL <https://pod.example/my-app/photo-jpg/photo.jpg> ;
  dcat:mediaType "image/jpeg" ;
  dcat:byteSize 2000000 .
<${docUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#TextDocument> ;
  dcterms:title "Q1 Report" ;
  dcterms:modified "2026-03-15T14:30:00.000Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${docUri}#dist> .
<${docUri}#dist> a dcat:Distribution ;
  dcat:accessURL <https://pod.example/my-app/report-pdf/report.pdf> ;
  dcat:mediaType "application/pdf" ;
  dcat:byteSize 512000 .
    `.trim();

    const entries = parseCatalog(turtle);

    expect(entries).toHaveLength(2);
    expect(entries[0].uri).toBe(imageUri);
    expect(entries[0].conformsTo).toBe("https://w3id.org/solid-drive#ImageFile");
    expect(entries[0].byteSize).toBe(2000000);
    expect(entries[1].uri).toBe(docUri);
    expect(entries[1].conformsTo).toBe("https://w3id.org/solid-drive#TextDocument");
    expect(entries[1].byteSize).toBe(512000);
  });

  it("does not cross-contaminate properties between entries", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const imageUri = "https://pod.example/my-app/photo/index.ttl";
    const videoUri = "https://pod.example/my-app/clip/index.ttl";

    const turtle = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<${catalogUri}> dcat:dataset <${imageUri}> .
<${catalogUri}> dcat:dataset <${videoUri}> .
<${imageUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#ImageFile> ;
  dcterms:title "Diagram" ;
  dcterms:modified "2026-01-01T00:00:00.000Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${imageUri}#dist> .
<${imageUri}#dist> a dcat:Distribution ;
  dcat:accessURL <https://pod.example/my-app/photo/diagram.png> ;
  dcat:mediaType "image/png" ;
  dcat:byteSize 100000 .
<${videoUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#VideoFile> ;
  dcterms:title "Screen recording" ;
  dcterms:modified "2026-02-01T00:00:00.000Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${videoUri}#dist> .
<${videoUri}#dist> a dcat:Distribution ;
  dcat:accessURL <https://pod.example/my-app/clip/clip.mp4> ;
  dcat:mediaType "video/mp4" ;
  dcat:byteSize 50000000 .
    `.trim();

    const entries = parseCatalog(turtle);

    expect(entries[0].mediaType).toBe("image/png");
    expect(entries[0].byteSize).toBe(100000);
    expect(entries[1].mediaType).toBe("video/mp4");
    expect(entries[1].byteSize).toBe(50000000);
  });

  it("handles titles with special characters", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/notes/index.ttl";

    const turtle = `
@prefix dcat:    <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<${catalogUri}> dcat:dataset <${instanceUri}> .
<${instanceUri}> a dcat:Dataset ;
  dcterms:conformsTo <https://w3id.org/solid-drive#TextDocument> ;
  dcterms:title "Q1 Report \\"Draft\\"" ;
  dcterms:modified "2026-03-01T00:00:00.000Z"^^xsd:dateTime ;
  dcterms:publisher <https://pod.example/profile/card#me> ;
  dcat:distribution <${instanceUri}#dist> .
<${instanceUri}#dist> a dcat:Distribution ;
  dcat:accessURL <https://pod.example/my-app/notes/notes.txt> ;
  dcat:mediaType "text/plain" ;
  dcat:byteSize 1024 .
    `.trim();

    const entries = parseCatalog(turtle);
    expect(entries[0].title).toBe('Q1 Report \\"Draft\\"');
  });

  it("returns zero byteSize and empty strings gracefully for missing properties", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/file/index.ttl";

    const turtle = `
@prefix dcat: <http://www.w3.org/ns/dcat#> .
<${catalogUri}> dcat:dataset <${instanceUri}> .
<${instanceUri}> a dcat:Dataset .
    `.trim();

    const entries = parseCatalog(turtle);
    expect(entries).toHaveLength(1);
    expect(entries[0].byteSize).toBe(0);
    expect(entries[0].mediaType).toBe("");
    expect(entries[0].conformsTo).toBe("");
    expect(entries[0].description).toBe("");
  });
});



describe("friendlyLabel", () => {
  it("returns the label for a known full URI", () => {
    expect(friendlyLabel("https://w3id.org/solid-drive#ImageFile")).toBe("Photo/Image");
    expect(friendlyLabel("https://w3id.org/solid-drive#VideoFile")).toBe("Video");
    expect(friendlyLabel("https://w3id.org/solid-drive#AudioFile")).toBe("Audio");
    expect(friendlyLabel("https://w3id.org/solid-drive#TextDocument")).toBe("Document");
    expect(friendlyLabel("http://schema.org/DigitalDocument")).toBe("File");
  });

  it("returns the label when matched by id", () => {
    expect(friendlyLabel("ImageFile")).toBe("Photo/Image");
  });

  it("falls back to the local name for unknown URIs", () => {
    expect(friendlyLabel("https://example.com/ontology#CustomType")).toBe("CustomType");
  });
});
