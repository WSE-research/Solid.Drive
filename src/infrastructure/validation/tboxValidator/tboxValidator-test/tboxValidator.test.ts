import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getShapeForType,
  validateMetadata,
  resetTBoxCache,
  loadTBox,
} from '../tboxValidator-file/tboxValidator';
import { parseTBox } from '../../tboxParser';

beforeEach(() => resetTBoxCache());

// Minimal TBox for testing
const TEST_TBOX = `
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .

schema:DigitalDocument
  a rdfs:Class, sh:NodeShape ;
  rdfs:label "Digital document" ;
  rdfs:subClassOf schema:CreativeWork ;
  sh:property schema:test-name ;
  sh:property schema:test-uploadDate ;
  sh:property schema:test-publisher ;
  sh:property schema:test-description ;
.

schema:MediaObject
  a rdfs:Class, sh:NodeShape ;
  rdfs:label "Media object" ;
  rdfs:subClassOf schema:CreativeWork ;
  sh:property schema:test-name ;
  sh:property schema:test-uploadDate ;
  sh:property schema:test-publisher ;
  sh:property schema:test-encodingFormat ;
  sh:property schema:test-contentSize ;
.

schema:ImageObject
  a rdfs:Class, sh:NodeShape ;
  rdfs:label "Image object" ;
  rdfs:subClassOf schema:MediaObject ;
.

schema:TextDigitalDocument
  a rdfs:Class, sh:NodeShape ;
  rdfs:subClassOf schema:DigitalDocument ;
.

schema:test-name
  a sh:PropertyShape ;
  sh:path schema:name ;
  sh:datatype xsd:string ;
  sh:name "name" ;
  sh:description "The name of the item." ;
  sh:minCount 1 ;
.

schema:test-uploadDate
  a sh:PropertyShape ;
  sh:path schema:uploadDate ;
  sh:datatype xsd:dateTime ;
  sh:name "uploadDate" ;
  sh:description "Upload date." ;
  sh:minCount 1 ;
.

schema:test-publisher
  a sh:PropertyShape ;
  sh:path schema:publisher ;
  sh:nodeKind sh:IRI ;
  sh:name "publisher" ;
  sh:description "The publisher." ;
  sh:minCount 1 ;
.

schema:test-description
  a sh:PropertyShape ;
  sh:path schema:description ;
  sh:datatype xsd:string ;
  sh:name "description" ;
  sh:description "A description." ;
.

schema:test-encodingFormat
  a sh:PropertyShape ;
  sh:path schema:encodingFormat ;
  sh:datatype xsd:string ;
  sh:name "encodingFormat" ;
  sh:description "MIME type." ;
.

schema:test-contentSize
  a sh:PropertyShape ;
  sh:path schema:contentSize ;
  sh:datatype xsd:string ;
  sh:name "contentSize" ;
  sh:description "File size." ;
.
`.trim();

describe("getShapeForType", () => {
  const { shapes, parents } = parseTBox(TEST_TBOX);

  it("returns shape for a direct type match", () => {
    const shape = getShapeForType(
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(shape).not.toBeNull();
    expect(shape!.label).toBe("Digital document");
  });

  it("inherits properties from parent type via subClassOf", () => {
    const shape = getShapeForType(
      "http://schema.org/ImageObject",
      shapes,
      parents
    );
    expect(shape).not.toBeNull();
    // ImageObject inherits from MediaObject which has encodingFormat and contentSize
    const allPaths = [
      ...shape!.requiredProperties.map((p) => p.path),
      ...shape!.optionalProperties.map((p) => p.path),
    ];
    expect(allPaths).toContain("http://schema.org/encodingFormat");
    expect(allPaths).toContain("http://schema.org/contentSize");
  });

  it("ImageObject inherits required name/uploadDate/publisher from MediaObject", () => {
    const shape = getShapeForType(
      "http://schema.org/ImageObject",
      shapes,
      parents
    );
    const requiredPaths = shape!.requiredProperties.map((p) => p.path);
    expect(requiredPaths).toContain("http://schema.org/name");
    expect(requiredPaths).toContain("http://schema.org/uploadDate");
    expect(requiredPaths).toContain("http://schema.org/publisher");
  });

  it("TextDigitalDocument inherits from DigitalDocument", () => {
    const shape = getShapeForType(
      "http://schema.org/TextDigitalDocument",
      shapes,
      parents
    );
    expect(shape).not.toBeNull();
    const requiredPaths = shape!.requiredProperties.map((p) => p.path);
    expect(requiredPaths).toContain("http://schema.org/name");
  });

  it("returns null for unknown type with no shape", () => {
    const shape = getShapeForType(
      "http://schema.org/UnknownType",
      shapes,
      parents
    );
    expect(shape).toBeNull();
  });

  it("de-duplicates properties across inherited shapes", () => {
    const shape = getShapeForType(
      "http://schema.org/ImageObject",
      shapes,
      parents
    );
    const allRequired = shape!.requiredProperties;
    const nameProps = allRequired.filter((p) => p.localName === "name");
    expect(nameProps).toHaveLength(1);
  });
});


describe("validateMetadata", () => {
  const { shapes, parents } = parseTBox(TEST_TBOX);

  it("returns valid when all required fields are present", () => {
    const result = validateMetadata(
      {
        name: "My Photo",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/profile/card#me" },
        encodingFormat: "image/jpeg",
        contentSize: "1024",
      },
      "http://schema.org/ImageObject",
      shapes,
      parents
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("returns valid=false with a 'name' violation when the name field is absent", () => {
    const result = validateMetadata(
      {
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/profile/card#me" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
    const nameViolation = result.violations.find((v) => v.localName === "name");
    expect(nameViolation).toBeDefined();
    expect(nameViolation!.label).toBe("name");
  });

  it("returns valid=false with an 'uploadDate' violation when the uploadDate field is absent", () => {
    const result = validateMetadata(
      {
        name: "My File",
        publisher: { "@id": "https://pod.example/profile/card#me" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
    const violation = result.violations.find(
      (v) => v.localName === "uploadDate"
    );
    expect(violation).toBeDefined();
  });

  it("returns valid=false with a 'publisher' violation when the publisher field is absent", () => {
    const result = validateMetadata(
      {
        name: "My File",
        uploadDate: new Date().toISOString(),
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
    const violation = result.violations.find(
      (v) => v.localName === "publisher"
    );
    expect(violation).toBeDefined();
  });

  it("returns valid=false with at least three violations when all required fields are absent", () => {
    const result = validateMetadata(
      {},
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts IRI values for publisher via @id", () => {
    const result = validateMetadata(
      {
        name: "My File",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/profile/card#me" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(true);
  });

  it("rejects empty string for required field", () => {
    const result = validateMetadata(
      {
        name: "",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/profile/card#me" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.localName === "name")).toBe(true);
  });

  it("accepts whitespace-only string as empty for required field", () => {
    const result = validateMetadata(
      {
        name: "   ",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/profile/card#me" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
  });

  it("does not require optional fields", () => {
    const result = validateMetadata(
      {
        name: "My File",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/profile/card#me" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    // description is optional, should not appear in violations
    const descViolation = result.violations.find(
      (v) => v.localName === "description"
    );
    expect(descViolation).toBeUndefined();
  });

  it("returns valid for unknown type (no shape in TBox)", () => {
    const result = validateMetadata(
      {},
      "http://schema.org/UnknownType",
      shapes,
      parents
    );
    expect(result.valid).toBe(true);
    expect(result.shape).toBeNull();
  });

  it("includes shape definition in result", () => {
    const result = validateMetadata(
      {
        name: "Photo",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/" },
      },
      "http://schema.org/ImageObject",
      shapes,
      parents
    );
    expect(result.shape).not.toBeNull();
    expect(result.shape!.requiredProperties.length).toBeGreaterThan(0);
    expect(result.shape!.optionalProperties.length).toBeGreaterThan(0);
  });

  it("ImageObject inherits validation from MediaObject", () => {
    const result = validateMetadata(
      {
        name: "Photo",
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/" },
        encodingFormat: "image/jpeg",
        contentSize: "2048",
      },
      "http://schema.org/ImageObject",
      shapes,
      parents
    );
    expect(result.valid).toBe(true);
  });

  it("accepts LDO array-like value with toArray for required field", () => {
    // This exercises isNonEmpty lines 191-192 (object with toArray method)
    const result = validateMetadata(
      {
        name: { toArray: () => ["value1"] },
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(true);
  });

  it("rejects LDO array-like value with empty toArray for required field", () => {
    // Empty toArray → isNonEmpty returns false
    const result = validateMetadata(
      {
        name: { toArray: () => [] },
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.localName === "name")).toBe(true);
  });

  it("accepts primitive non-string value for required field (isNonEmpty returns true)", () => {
    // This exercises isNonEmpty line 194 (return true for number/boolean)
    const result = validateMetadata(
      {
        name: 42,
        uploadDate: new Date().toISOString(),
        publisher: { "@id": "https://pod.example/" },
      },
      "http://schema.org/DigitalDocument",
      shapes,
      parents
    );
    expect(result.valid).toBe(true);
  });

  it("parses the actual tbox.ttl file and finds schema.org shapes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const tboxPath = path.resolve(__dirname, "../../../../../public/tbox.ttl");
    const turtle = fs.readFileSync(tboxPath, "utf-8");
    const { shapes: realShapes, parents: realParents } = parseTBox(turtle);

    // The real TBox should have shapes
    expect(realShapes.size).toBeGreaterThan(0);

    // Key schema.org types should be present
    expect(realShapes.has("http://schema.org/ImageObject")).toBe(true);
    expect(realShapes.has("http://schema.org/MediaObject")).toBe(true);

    // Inheritance should be recorded
    expect(realParents.get("http://schema.org/ImageObject")).toContain(
      "http://schema.org/MediaObject"
    );

    // getShapeForType should resolve a merged shape for ImageObject
    const shape = getShapeForType(
      "http://schema.org/ImageObject",
      realShapes,
      realParents
    );
    expect(shape).not.toBeNull();
  });

  it("handles circular parent relationships without infinite looping", () => {
    // TypeA → TypeB → TypeA (circular)
    const circularParents = new Map<string, string[]>([
      ["http://schema.org/TypeA", ["http://schema.org/TypeB"]],
      ["http://schema.org/TypeB", ["http://schema.org/TypeA"]],
    ]);
    const circularShapes = new Map([
      ["http://schema.org/TypeA", { uri: "http://schema.org/TypeA", label: "Type A", requiredProperties: [], optionalProperties: [] }],
    ]) as Parameters<typeof getShapeForType>[1];
    // Should not throw or infinite-loop; visited.has(current) guard fires
    const shape = getShapeForType("http://schema.org/TypeA", circularShapes, circularParents);
    expect(shape).not.toBeNull();
  });
});


// ─── loadTBox ─────────────────────────────────────────────────────────────────

const makeFetch = (status: number, body = "") =>
  vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => body,
  })) as unknown as typeof fetch;

describe("loadTBox", () => {
  beforeEach(() => resetTBoxCache());

  it("fetches and parses the TBox, returning shapes and parents", async () => {
    const { shapes, parents } = await loadTBox("https://example.com/tbox.ttl", makeFetch(200, TEST_TBOX));
    expect(shapes.size).toBeGreaterThan(0);
    expect(parents.size).toBeGreaterThan(0);
  });

  it("throws when the fetch returns a non-OK status", async () => {
    await expect(loadTBox("https://example.com/tbox.ttl", makeFetch(404))).rejects.toThrow("404");
  });

  it("returns cached result on subsequent calls without fetching again", async () => {
    const fetchFn = makeFetch(200, TEST_TBOX);
    await loadTBox("https://example.com/tbox.ttl", fetchFn);
    await loadTBox("https://example.com/tbox.ttl", fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("fetches again after resetTBoxCache", async () => {
    const fetchFn = makeFetch(200, TEST_TBOX);
    await loadTBox("https://example.com/tbox.ttl", fetchFn);
    resetTBoxCache();
    await loadTBox("https://example.com/tbox.ttl", fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
