import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseFileTypesFromTurtle,
  loadFileTypes,
  resetFileTypeCache,
  getFileType,
  isKnownFileType,
  getFileTypeLabel,
  getFileTypeInfo,
  getFileTypeUri,
  getAllFileTypes,
  getFileTypesSync,
  resolveClass,
} from '../fileTypeRegistry-file/fileTypeRegistry';

const SAMPLE_TURTLE = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

schema:CreativeWork
  a rdfs:Class ;
  rdfs:label "Creative work" ;
  rdfs:comment "The most generic kind of creative work." ;
.

schema:MediaObject
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "A media object, such as an image, video, or audio object."^^rdf:HTML ;
  rdfs:label "Media object" ;
  rdfs:subClassOf schema:CreativeWork ;
.

schema:DigitalDocument
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "An electronic file or document."^^rdf:HTML ;
  rdfs:label "Digital document" ;
  rdfs:subClassOf schema:CreativeWork ;
.

schema:ImageObject
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "An image file, <b>such as</b> a photo."^^rdf:HTML ;
  rdfs:label "Image" ;
  rdfs:subClassOf schema:MediaObject ;
.

schema:VideoObject
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "A video file." ;
  rdfs:label "Video" ;
  rdfs:subClassOf schema:MediaObject ;
.

schema:AudioObject
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "An audio file such as a song or podcast episode." ;
  rdfs:label "Audio" ;
  rdfs:subClassOf schema:MediaObject ;
.

schema:TextDigitalDocument
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "A file composed primarily of text." ;
  rdfs:label "Text digital document" ;
  rdfs:subClassOf schema:DigitalDocument ;
.

schema:SpreadsheetDigitalDocument
  a rdfs:Class ;
  a sh:NodeShape ;
  rdfs:comment "A spreadsheet file." ;
  rdfs:label "Spreadsheet digital document" ;
  rdfs:subClassOf schema:DigitalDocument ;
.

schema:Person
  a rdfs:Class ;
  rdfs:label "Person" ;
  rdfs:comment "A person." ;
.
`;

describe("fileTypeRegistry", () => {
  beforeEach(() => {
    resetFileTypeCache();
  });

  describe("parseFileTypesFromTurtle", () => {
    it("returns parsed file types including uri, label, and HTML-stripped description from valid turtle", () => {
      const types = parseFileTypesFromTurtle(SAMPLE_TURTLE);

      expect(types.length).toBeGreaterThanOrEqual(6);
      
      const imageType = types.find((t) => t.id === "ImageObject");
      expect(imageType).toBeDefined();
      expect(imageType?.uri).toBe("http://schema.org/ImageObject");
      expect(imageType?.label).toBe("Image");
      // HTML should be stripped from description
      expect(imageType?.description).toBe("An image file, such as a photo.");
    });

    it("strips HTML tags from descriptions", () => {
      const types = parseFileTypesFromTurtle(SAMPLE_TURTLE);
      const imageType = types.find((t) => t.id === "ImageObject");
      expect(imageType?.description).not.toContain("<b>");
      expect(imageType?.description).not.toContain("</b>");
    });

    it("returns default types for invalid turtle", () => {
      const types = parseFileTypesFromTurtle("this is not valid turtle {{{");
      expect(types.length).toBeGreaterThan(0);
      expect(types.find((t) => t.id === "DigitalDocument")).toBeDefined();
    });

    it("returns default types for empty turtle", () => {
      const types = parseFileTypesFromTurtle("");
      expect(types.length).toBeGreaterThan(0);
    });

    it("truncates long descriptions exceeding FILE_TYPE_DESCRIPTION_MAX_LENGTH", () => {
      const longComment = "A".repeat(250);
      const turtle = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .

schema:TestLongDesc
  a rdfs:Class ;
  rdfs:label "Test long description" ;
  rdfs:comment "${longComment}" ;
.
`;
      const types = parseFileTypesFromTurtle(turtle);
      const testType = types.find((t) => t.id === "TestLongDesc");
      expect(testType).toBeDefined();
      // FILE_TYPE_DESCRIPTION_MAX_LENGTH is 200, so truncated = 197 chars + "..."
      expect(testType!.description.length).toBeLessThanOrEqual(200);
      expect(testType!.description).toMatch(/\.\.\.$/);
    });

    it("generates a humanized label from the class ID when rdfs:label is absent", () => {
      const turtle = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .

schema:ImageObject
  a rdfs:Class ;
  rdfs:comment "No label here" ;
.
`;
      const types = parseFileTypesFromTurtle(turtle);
      const imageType = types.find((t) => t.id === "ImageObject");
      expect(imageType).toBeDefined();
      // humanizeId("ImageObject") → "Image object"
      expect(imageType!.label).toBe("Image object");
    });

    it("correctly humanizes IDs with consecutive uppercase letters", () => {
      const turtle = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .

schema:HTMLDocument
  a rdfs:Class ;
.
`;
      const types = parseFileTypesFromTurtle(turtle);
      const htmlType = types.find((t) => t.id === "HTMLDocument");
      expect(htmlType).toBeDefined();
      // humanizeId("HTMLDocument") → "HTML Document" → lowercase → "html document" → capitalize → "Html document"
      // Actually: .replace(/([a-z])([A-Z])/g, "$1 $2") has no effect (no lowercase before uppercase)
      //           .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") → "HTML Document"
      //           .toLowerCase() → "html document"
      //           .replace(/^\w/, c => c.toUpperCase()) → "Html document"
      expect(htmlType!.label).toBe("Html document");
    });
  });

  describe("loadFileTypes", () => {
    it("fetches file types from TBox and returns the same cached instance on repeated calls", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });

      const types = await loadFileTypes("/tbox.ttl", mockFetch);
      expect(types.length).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const types2 = await loadFileTypes("/tbox.ttl", mockFetch);
      expect(types2).toBe(types);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws when TBox fetch returns a non-ok status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(loadFileTypes("/tbox.ttl", mockFetch)).rejects.toThrow(
        "Failed to load TBox"
      );
    });

    it("deduplicates concurrent requests", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });

      // Start multiple concurrent requests
      const [types1, types2, types3] = await Promise.all([
        loadFileTypes("/tbox.ttl", mockFetch),
        loadFileTypes("/tbox.ttl", mockFetch),
        loadFileTypes("/tbox.ttl", mockFetch),
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(types1).toBe(types2);
      expect(types2).toBe(types3);
    });
  });

  describe("getFileTypesSync", () => {
    it("returns null when not loaded", () => {
      expect(getFileTypesSync()).toBeNull();
    });

    it("returns the cached file types after loadFileTypes has been called", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });

      await loadFileTypes("/tbox.ttl", mockFetch);
      expect(getFileTypesSync()).not.toBeNull();
      expect(getFileTypesSync()!.length).toBeGreaterThan(0);
    });
  });

  describe("getFileType", () => {
    beforeEach(async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });
      await loadFileTypes("/tbox.ttl", mockFetch);
    });

    it("returns the matching file type when looked up by ID", () => {
      const type = getFileType("ImageObject");
      expect(type).toBeDefined();
      expect(type?.id).toBe("ImageObject");
    });

    it("returns the matching file type when looked up by URI", () => {
      const type = getFileType("http://schema.org/ImageObject");
      expect(type).toBeDefined();
      expect(type?.id).toBe("ImageObject");
    });

    it("returns undefined for unknown type", () => {
      expect(getFileType("UnknownType")).toBeUndefined();
    });
  });

  describe("isKnownFileType", () => {
    it("returns true for known types", () => {
      expect(isKnownFileType("ImageObject")).toBe(true);
      expect(isKnownFileType("http://schema.org/VideoObject")).toBe(true);
    });

    it("returns false for unknown types", () => {
      expect(isKnownFileType("RandomThing")).toBe(false);
    });
  });

  describe("getFileTypeLabel", () => {
    beforeEach(async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });
      await loadFileTypes("/tbox.ttl", mockFetch);
    });

    it("returns the registered label for a known type ID", () => {
      expect(getFileTypeLabel("ImageObject")).toBe("Image");
    });

    it("returns extracted local name for unknown type", () => {
      expect(getFileTypeLabel("http://example.org/CustomType")).toBe("CustomType");
    });
  });

  describe("getFileTypeInfo", () => {
    beforeEach(async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });
      await loadFileTypes("/tbox.ttl", mockFetch);
    });

    it("returns the label and description for a known type", () => {
      const info = getFileTypeInfo("ImageObject");
      expect(info.label).toBe("Image");
      expect(info.description).toContain("image file");
    });

    it("returns extracted local name and empty description for an unknown type", () => {
      const info = getFileTypeInfo("http://example.org/Mystery");
      expect(info.label).toBe("Mystery");
      expect(info.description).toBe("");
    });
  });

  describe("getFileTypeUri", () => {
    it("returns the full schema.org URI for a known type ID", () => {
      expect(getFileTypeUri("ImageObject")).toBe("http://schema.org/ImageObject");
    });

    it("returns default DigitalDocument URI for unknown ID", () => {
      expect(getFileTypeUri("Unknown")).toBe("http://schema.org/DigitalDocument");
    });
  });

  describe("getAllFileTypes", () => {
    it("returns all registered types including ImageObject and VideoObject after loading", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });
      await loadFileTypes("/tbox.ttl", mockFetch);

      const types = getAllFileTypes();
      expect(types.length).toBeGreaterThan(0);
      expect(types.some((t) => t.id === "ImageObject")).toBe(true);
      expect(types.some((t) => t.id === "VideoObject")).toBe(true);
    });

    it("discovers ALL schema.org classes from TTL, not just a predefined list", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });
      await loadFileTypes("/tbox.ttl", mockFetch);

      const types = getAllFileTypes();
      // Should find all classes in the sample, including Person (not a "file type")
      expect(types.some((t) => t.id === "Person")).toBe(true);
      expect(types.some((t) => t.id === "CreativeWork")).toBe(true);
      expect(types.some((t) => t.id === "MediaObject")).toBe(true);
    });
  });

  describe("resolveClass", () => {
    it("maps image MIME types to schema:ImageObject", () => {
      expect(resolveClass("image/jpeg")).toBe("http://schema.org/ImageObject");
      expect(resolveClass("image/png")).toBe("http://schema.org/ImageObject");
      expect(resolveClass("image/gif")).toBe("http://schema.org/ImageObject");
      expect(resolveClass("image/webp")).toBe("http://schema.org/ImageObject");
    });

    it("maps video MIME types to schema:VideoObject", () => {
      expect(resolveClass("video/mp4")).toBe("http://schema.org/VideoObject");
      expect(resolveClass("video/webm")).toBe("http://schema.org/VideoObject");
      expect(resolveClass("video/ogg")).toBe("http://schema.org/VideoObject");
    });

    it("maps audio MIME types to schema:AudioObject", () => {
      expect(resolveClass("audio/mpeg")).toBe("http://schema.org/AudioObject");
      expect(resolveClass("audio/wav")).toBe("http://schema.org/AudioObject");
      expect(resolveClass("audio/ogg")).toBe("http://schema.org/AudioObject");
    });

    it("maps text/* MIME types to schema:TextDigitalDocument", () => {
      expect(resolveClass("text/plain")).toBe("http://schema.org/TextDigitalDocument");
      expect(resolveClass("text/html")).toBe("http://schema.org/TextDigitalDocument");
    });

    it("maps PDF and Word document MIME types to schema:TextDigitalDocument", () => {
      expect(resolveClass("application/pdf")).toBe("http://schema.org/TextDigitalDocument");
      expect(resolveClass("application/msword")).toBe("http://schema.org/TextDigitalDocument");
      expect(resolveClass("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        .toBe("http://schema.org/TextDigitalDocument");
      expect(resolveClass("application/rtf")).toBe("http://schema.org/TextDigitalDocument");
    });

    it("maps spreadsheet MIME types to schema:SpreadsheetDigitalDocument", () => {
      expect(resolveClass("text/csv")).toBe("http://schema.org/SpreadsheetDigitalDocument");
      expect(resolveClass("application/vnd.ms-excel")).toBe("http://schema.org/SpreadsheetDigitalDocument");
      expect(resolveClass("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .toBe("http://schema.org/SpreadsheetDigitalDocument");
    });

    it("falls back to schema:DigitalDocument for unknown MIME types", () => {
      expect(resolveClass("application/zip")).toBe("http://schema.org/DigitalDocument");
      expect(resolveClass("application/octet-stream")).toBe("http://schema.org/DigitalDocument");
      expect(resolveClass("")).toBe("http://schema.org/DigitalDocument");
    });
  });

  describe("parentTypes", () => {
    beforeEach(async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_TURTLE),
      });
      await loadFileTypes("/tbox.ttl", mockFetch);
    });

    it("includes parent types from rdfs:subClassOf", () => {
      const imageType = getFileType("ImageObject");
      expect(imageType?.parentTypes).toContain("http://schema.org/MediaObject");
    });

    it("captures multiple parent types if present", () => {
      const textDoc = getFileType("TextDigitalDocument");
      expect(textDoc?.parentTypes).toContain("http://schema.org/DigitalDocument");
    });
  });

  describe("getFileTypeLabel fallback", () => {
    it("extracts local name from URI when type is unknown", () => {
      resetFileTypeCache();
      const label = getFileTypeLabel("http://example.org/SomeUnknownType");
      expect(label).toBe("SomeUnknownType");
    });

    it("extracts local name from hash URI when type is unknown", () => {
      resetFileTypeCache();
      const label = getFileTypeLabel("http://example.org#MyType");
      expect(label).toBe("MyType");
    });
  });

  describe("getFileTypeInfo fallback", () => {
    it("returns extracted local name and empty description for unknown type", () => {
      resetFileTypeCache();
      const info = getFileTypeInfo("http://example.org/UnknownType");
      expect(info.label).toBe("UnknownType");
      expect(info.description).toBe("");
    });
  });

  describe("getAllFileTypes with no cache", () => {
    it("returns default file types when cache is null", () => {
      resetFileTypeCache();
      const types = getAllFileTypes();
      expect(types.length).toBeGreaterThan(0);
      // Should include at least DigitalDocument from defaults
      expect(types.some((t) => t.id === "DigitalDocument")).toBe(true);
    });
  });
});
