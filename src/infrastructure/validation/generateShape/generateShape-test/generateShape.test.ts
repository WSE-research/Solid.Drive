import { describe, it, expect } from "vitest";
import { discoverShapesFromTurtle } from '../generateShape-file/generateShape';

const DCAT_NS = "http://www.w3.org/ns/dcat#";
const DCTERMS_NS = "http://purl.org/dc/terms/";
const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

function findShape(shapes: ReturnType<typeof discoverShapesFromTurtle>, name: string) {
  return shapes.find((s) => s.typeName === name);
}

function findProp(
  shape: ReturnType<typeof discoverShapesFromTurtle>[number],
  predIri: string
) {
  return shape.properties.find((p) => p.predicate === predIri);
}

describe("discoverShapesFromTurtle", () => {
  it("returns an empty array for a document with no rdf:type triples", () => {
    const turtle = `
      @prefix ex: <http://example.org/> .
      <http://example.org/a> ex:name "Alice" .
    `;
    expect(discoverShapesFromTurtle(turtle)).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(discoverShapesFromTurtle("")).toEqual([]);
  });

  it("discovers a single shape for one rdf:type", () => {
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1> a dcat:Dataset .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].typeName).toBe("dcat:Dataset");
  });

  it("uses the prefixed name when a matching @prefix is declared", () => {
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1> a dcat:Dataset .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    expect(shapes[0].typeName).toBe("dcat:Dataset");
  });

  it("falls back to the local name when no matching prefix exists", () => {
    const turtle = `
      <http://example.org/ds1>
        <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
        <http://unknown.ns/MyType> .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    expect(shapes[0].typeName).toBe("MyType");
  });

  it("collects string literal predicates with typeLabel xsd:string", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/ds1>
        a dcat:Dataset ;
        dcterms:title "My Dataset" .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, `${DCTERMS_NS}title`)!;

    expect(prop).toBeDefined();
    expect(prop.types.has("xsd:string")).toBe(true);
    expect(prop.occurrences).toBe(1);
    expect(prop.totalSubjects).toBe(1);
  });

  it("labels IRI-valued predicates as 'IRI'", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/ds1>
        a dcat:Dataset ;
        dcterms:publisher <https://pod.example/profile/card#me> .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, `${DCTERMS_NS}publisher`)!;

    expect(prop.types.has("IRI")).toBe(true);
  });

  it("labels typed xsd:dateTime literals correctly", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .
      @prefix xsd:     <${XSD_NS}> .

      <http://example.org/ds1>
        a dcat:Dataset ;
        dcterms:modified "2026-03-16T11:52:13.066Z"^^xsd:dateTime .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, `${DCTERMS_NS}modified`)!;

    expect(prop.types.has("xsd:dateTime")).toBe(true);
  });

  it("labels typed xsd:integer literals correctly", () => {
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      @prefix xsd:  <${XSD_NS}> .

      <http://example.org/dist1>
        a dcat:Distribution ;
        dcat:byteSize 4096 .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Distribution")!;
    const prop   = findProp(shape, `${DCAT_NS}byteSize`)!;

    expect([...prop.types].some((t) => t.includes("integer"))).toBe(true);
  });

  it("counts occurrences across all subjects of the same type", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/ds1> a dcat:Dataset ; dcterms:title "One" .
      <http://example.org/ds2> a dcat:Dataset ; dcterms:title "Two" .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, `${DCTERMS_NS}title`)!;

    expect(prop.occurrences).toBe(2);
    expect(prop.totalSubjects).toBe(2);
  });

  it("reports totalSubjects correctly when not every subject has every predicate", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/ds1> a dcat:Dataset ; dcterms:title "Has title" .
      <http://example.org/ds2> a dcat:Dataset .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, `${DCTERMS_NS}title`)!;

    expect(prop.totalSubjects).toBe(2);
    expect(prop.occurrences).toBe(1);
  });

  it("merges value-kind Sets across subjects (IRI and string for same predicate)", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/ds1> a dcat:Dataset ; dcterms:description "plain text" .
      <http://example.org/ds2> a dcat:Dataset ; dcterms:description <http://example.org/desc2> .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, `${DCTERMS_NS}description`)!;

    expect(prop.types.has("xsd:string")).toBe(true);
    expect(prop.types.has("IRI")).toBe(true);
  });

  it("assigns a subject's properties to ALL of its rdf:types", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/item1>
        a dcat:Dataset , dcat:Distribution ;
        dcterms:title "Dual-typed item" .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const dataset = findShape(shapes, "dcat:Dataset")!;
    const dist    = findShape(shapes, "dcat:Distribution")!;

    expect(findProp(dataset, `${DCTERMS_NS}title`)).toBeDefined();
    expect(findProp(dist,    `${DCTERMS_NS}title`)).toBeDefined();
  });

  it("discovers multiple distinct shapes from a mixed document", () => {
    const turtle = `
      @prefix dcat:    <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .

      <http://example.org/ds1>   a dcat:Dataset      ; dcterms:title "Dataset one" .
      <http://example.org/cat1>  a dcat:Catalog      ; dcterms:title "My catalog" .
      <http://example.org/dist1> a dcat:Distribution ; dcat:mediaType "image/png" .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const names  = shapes.map((s) => s.typeName).sort();

    expect(names).toEqual(["dcat:Catalog", "dcat:Dataset", "dcat:Distribution"]);
  });

  it("does not include rdf:type itself as a discovered property", () => {
    const rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1> a dcat:Dataset .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;

    expect(shape.properties.every((p) => p.predicate !== rdfType)).toBe(true);
  });

  it("handles a subject with no non-type predicates (empty properties)", () => {
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1> a dcat:Dataset .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;

    expect(shape.properties).toEqual([]);
  });

  // --- Branch coverage additions ---

  it("returns empty array for invalid turtle", () => {
    const result = discoverShapesFromTurtle("this is not { valid } turtle <<<");
    expect(result).toEqual([]);
  });

  it("handles literal with unknown datatype (no prefix match → falls back to xsd:localName)", () => {
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1>
        a dcat:Dataset ;
        <http://example.org/customProp> "value"^^<http://custom.ns/MyDatatype> .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, "http://example.org/customProp")!;

    // No prefix for http://custom.ns/ → falls back to xsd:MyDatatype
    expect(prop).toBeDefined();
    expect([...prop.types].some(t => t.includes("MyDatatype"))).toBe(true);
  });

  it("handles object that is not NamedNode and has no datatype (plain literal → xsd:string)", () => {
    // A Literal with no explicit datatype should be classified as xsd:string
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1>
        a dcat:Dataset ;
        <http://example.org/label> "plain text" .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    const shape  = findShape(shapes, "dcat:Dataset")!;
    const prop   = findProp(shape, "http://example.org/label")!;

    // Plain string literals have xsd:string datatype by default in N3
    expect(prop).toBeDefined();
    expect(prop.types.size).toBeGreaterThan(0);
  });

  it("handles type IRI with no prefix and no # or / separators (splitIri returns null)", () => {
    // A type IRI like "urn:MyType" — has no / after the prefix
    const turtle = `
      <http://example.org/ds1>
        <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
        <urn:SomeType> .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    // splitIri('urn:SomeType') → lastIndexOf('#') = -1, lastIndexOf('/') = -1 → returns null
    // getPrefixForIri returns null → falls back to getLocalName
    // getLocalName → splitIri returns null → ?? iri → 'urn:SomeType'
    expect(shapes).toHaveLength(1);
    expect(shapes[0].typeName).toBe('urn:SomeType');
  });

  it("handles rdf:type with non-NamedNode object (should be skipped)", () => {
    // When rdf:type value is a literal (unusual but possible), it should be skipped
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      <http://example.org/ds1> a dcat:Dataset .
      <http://example.org/ds1>
        <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
        "StringType" .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    // Only dcat:Dataset should be discovered (the literal "StringType" is skipped)
    expect(shapes).toHaveLength(1);
    expect(shapes[0].typeName).toBe("dcat:Dataset");
  });

  it("classifies blank node property values as xsd:string (lines 152-153)", () => {
    // A blank node value is neither NamedNode nor Literal → falls to else → xsd:string
    const turtle = `
      @prefix dcat: <${DCAT_NS}> .
      @prefix dcterms: <${DCTERMS_NS}> .
      <http://example.org/ds1> a dcat:Dataset ;
        dcterms:creator [ <http://xmlns.com/foaf/0.1/name> "Alice" ] .
    `;
    const shapes = discoverShapesFromTurtle(turtle);
    expect(shapes).toHaveLength(1);
    const creatorProp = findProp(shapes[0], `${DCTERMS_NS}creator`);
    expect(creatorProp).toBeDefined();
    expect(creatorProp!.types).toContain("xsd:string");
  });
});
