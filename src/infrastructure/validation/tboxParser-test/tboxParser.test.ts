import { describe, it, expect } from 'vitest';
import { parseTBox } from '../tboxParser';

const SH = 'http://www.w3.org/ns/shacl#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const EX = 'http://example.org/';

function makeTurtle(lines: string[]): string {
  return [
    `@prefix sh: <${SH}> .`,
    `@prefix rdf: <${RDF}> .`,
    `@prefix rdfs: <${RDFS}> .`,
    `@prefix ex: <${EX}> .`,
    '',
    ...lines,
  ].join('\n');
}

describe('parseTBox', () => {
  it('returns empty maps for invalid turtle', () => {
    const result = parseTBox('this is not valid turtle {{{{');
    expect(result.shapes.size).toBe(0);
    expect(result.parents.size).toBe(0);
  });

  it('returns empty maps for empty turtle', () => {
    const result = parseTBox('');
    expect(result.shapes.size).toBe(0);
    expect(result.parents.size).toBe(0);
  });

  it('parses a NodeShape with required and optional properties', () => {
    const turtle = makeTurtle([
      'ex:PersonShape a sh:NodeShape ;',
      '  rdfs:label "Person" ;',
      '  sh:property ex:nameProp ;',
      '  sh:property ex:ageProp .',
      '',
      'ex:nameProp sh:path ex:name ;',
      '  sh:minCount 1 ;',
      '  sh:datatype <http://www.w3.org/2001/XMLSchema#string> ;',
      '  sh:name "Full Name" ;',
      '  sh:description "The person name" .',
      '',
      'ex:ageProp sh:path ex:age ;',
      '  sh:datatype <http://www.w3.org/2001/XMLSchema#integer> .',
    ]);

    const result = parseTBox(turtle);
    expect(result.shapes.size).toBe(1);

    const shape = result.shapes.get(`${EX}PersonShape`);
    expect(shape).toBeDefined();
    expect(shape!.label).toBe('Person');
    expect(shape!.uri).toBe(`${EX}PersonShape`);

    // nameProp has minCount 1 → required
    expect(shape!.requiredProperties).toHaveLength(1);
    expect(shape!.requiredProperties[0].path).toBe(`${EX}name`);
    expect(shape!.requiredProperties[0].label).toBe('Full Name');
    expect(shape!.requiredProperties[0].description).toBe('The person name');
    expect(shape!.requiredProperties[0].minCount).toBe(1);
    expect(shape!.requiredProperties[0].localName).toBe('name');

    // ageProp has no minCount → optional (default 0)
    expect(shape!.optionalProperties).toHaveLength(1);
    expect(shape!.optionalProperties[0].path).toBe(`${EX}age`);
    expect(shape!.optionalProperties[0].minCount).toBe(0);
  });

  it('parses rdfs:subClassOf relationships', () => {
    const turtle = makeTurtle([
      'ex:Child rdfs:subClassOf ex:Parent .',
      'ex:Child rdfs:subClassOf ex:AnotherParent .',
    ]);

    const result = parseTBox(turtle);
    expect(result.parents.get(`${EX}Child`)).toEqual([
      `${EX}Parent`,
      `${EX}AnotherParent`,
    ]);
  });

  it('uses localName as label when no rdfs:label is present', () => {
    const turtle = makeTurtle([
      'ex:BookShape a sh:NodeShape ;',
      '  sh:property ex:titleProp .',
      '',
      'ex:titleProp sh:path ex:title ;',
      '  sh:minCount 1 .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}BookShape`);
    expect(shape).toBeDefined();
    // No rdfs:label → falls back to localName of the shape URI
    expect(shape!.label).toBe('BookShape');
  });

  it('returns null for a property with no sh:path (skips it)', () => {
    const turtle = makeTurtle([
      'ex:TestShape a sh:NodeShape ;',
      '  sh:property ex:nopathProp ;',
      '  sh:property ex:validProp .',
      '',
      // nopathProp has no sh:path → should be skipped
      'ex:nopathProp sh:minCount 1 .',
      '',
      'ex:validProp sh:path ex:valid .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}TestShape`);
    expect(shape).toBeDefined();
    // Only validProp should appear (nopathProp skipped)
    expect(shape!.requiredProperties).toHaveLength(0);
    expect(shape!.optionalProperties).toHaveLength(1);
    expect(shape!.optionalProperties[0].path).toBe(`${EX}valid`);
  });

  it('uses localName of path as label when no sh:name is present', () => {
    const turtle = makeTurtle([
      'ex:Shape a sh:NodeShape ;',
      '  sh:property ex:prop .',
      '',
      'ex:prop sh:path ex:myProperty .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}Shape`);
    expect(shape!.optionalProperties[0].label).toBe('myProperty');
  });

  it('uses empty string as description when no sh:description is present', () => {
    const turtle = makeTurtle([
      'ex:Shape a sh:NodeShape ;',
      '  sh:property ex:prop .',
      '',
      'ex:prop sh:path ex:myProperty .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}Shape`);
    expect(shape!.optionalProperties[0].description).toBe('');
  });

  it('includes sh:nodeKind value in the property when nodeKind is specified', () => {
    const turtle = makeTurtle([
      'ex:Shape a sh:NodeShape ;',
      '  sh:property ex:prop .',
      '',
      'ex:prop sh:path ex:link ;',
      '  sh:nodeKind sh:IRI .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}Shape`);
    expect(shape!.optionalProperties[0].nodeKind).toBe(`${SH}IRI`);
  });

  it('defaults nodeKind and datatype to empty strings', () => {
    const turtle = makeTurtle([
      'ex:Shape a sh:NodeShape ;',
      '  sh:property ex:prop .',
      '',
      'ex:prop sh:path ex:simple .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}Shape`);
    expect(shape!.optionalProperties[0].datatype).toBe('');
    expect(shape!.optionalProperties[0].nodeKind).toBe('');
  });

  it('extracts localName from the fragment part of a URI with # separator', () => {
    const turtle = makeTurtle([
      'ex:Shape a sh:NodeShape ;',
      '  sh:property ex:prop .',
      '',
      'ex:prop sh:path <http://example.org/vocab#firstName> .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}Shape`);
    expect(shape!.optionalProperties[0].localName).toBe('firstName');
  });

  it('returns the full URI as localName when there is no # or /', () => {
    // localName function: if no # or / → returns the whole uri
    // This is hard to trigger via Turtle parsing since URIs typically have /,
    // but we test via a shape URI that effectively ends up with no separator
    // The localName function handles index < 0 → returns uri
    // We can test this by providing a URI like "urn:noSlashOrHash"
    const turtle = makeTurtle([
      '<urn:noSeparator> a sh:NodeShape .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get('urn:noSeparator');
    expect(shape).toBeDefined();
    // localName('urn:noSeparator') → 'noSeparator' (has : but lastIndexOf('/') = -1, lastIndexOf('#') = -1)
    // Wait — 'urn:noSeparator' has no / or # → index = max(-1, -1) = -1 → returns 'urn:noSeparator'
    expect(shape!.label).toBe('urn:noSeparator');
  });

  it('returns all shape definitions when the turtle contains multiple NodeShapes', () => {
    const turtle = makeTurtle([
      'ex:ShapeA a sh:NodeShape ;',
      '  rdfs:label "Shape A" .',
      '',
      'ex:ShapeB a sh:NodeShape ;',
      '  rdfs:label "Shape B" .',
    ]);

    const result = parseTBox(turtle);
    expect(result.shapes.size).toBe(2);
    expect(result.shapes.get(`${EX}ShapeA`)!.label).toBe('Shape A');
    expect(result.shapes.get(`${EX}ShapeB`)!.label).toBe('Shape B');
  });

  it('returns shape with empty required and optional property arrays when shape has no sh:property', () => {
    const turtle = makeTurtle([
      'ex:EmptyShape a sh:NodeShape ;',
      '  rdfs:label "Empty" .',
    ]);

    const result = parseTBox(turtle);
    const shape = result.shapes.get(`${EX}EmptyShape`);
    expect(shape).toBeDefined();
    expect(shape!.requiredProperties).toHaveLength(0);
    expect(shape!.optionalProperties).toHaveLength(0);
  });
});
