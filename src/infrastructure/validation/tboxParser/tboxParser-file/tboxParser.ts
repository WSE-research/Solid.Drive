/**
 * SHACL TBox parsing utilities.
 *
 * @remarks
 * Parses SHACL NodeShape definitions from Turtle text for validation.
 *
 * @packageDocumentation
 */

import { Parser as N3Parser, Store as N3Store } from "n3";
import { RDF_NAMESPACES } from "@/config";
import type { ShapeDefinition, PropertyConstraint } from "../../tboxTypes";

const SH = RDF_NAMESPACES.SHACL;
const RDF = RDF_NAMESPACES.RDF;
const RDFS = RDF_NAMESPACES.RDFS;

/**
 * Parses Turtle text into shape definitions and a parent map.
 *
 * @remarks
 * Pure parsing — no I/O. Extracts `sh:NodeShape` definitions
 * and `rdfs:subClassOf` relationships.
 *
 * @param turtle - Raw Turtle content
 * @returns Object with shapes map and parents map
 *
 * @public
 */
export function parseTBox(turtle: string): {
  shapes: Map<string, ShapeDefinition>;
  parents: Map<string, string[]>;
} {
  let quads;
  try {
    quads = new N3Parser().parse(turtle);
  } catch {
    return { shapes: new Map(), parents: new Map() };
  }

  const store = new N3Store(quads);
  const shapes = new Map<string, ShapeDefinition>();
  const parents = new Map<string, string[]>();

  const nodeShapeQuads = store.getQuads(null, `${RDF}type`, `${SH}NodeShape`, null);
  const nodeShapeUris = new Set(nodeShapeQuads.map((quad) => quad.subject.value));

  const subClassQuads = store.getQuads(null, `${RDFS}subClassOf`, null, null);
  for (const quad of subClassQuads) {
    const child = quad.subject.value;
    const parent = quad.object.value;
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child)!.push(parent);
  }

  for (const shapeUri of nodeShapeUris) {
    const shape = extractShape(store, shapeUri);
    if (shape) shapes.set(shapeUri, shape);
  }

  return { shapes, parents };
}

/**
 * Builds a shape definition from a NodeShape URI.
 *
 * @remarks
 * Splits properties into required (minCount > 0) and optional.
 *
 * @param store - N3 Store with parsed quads
 * @param shapeUri - URI of the NodeShape
 * @returns Shape definition, or null if invalid
 *
 * @internal
 */
function extractShape(store: N3Store, shapeUri: string): ShapeDefinition | null {
  const labelQuads = store.getObjects(shapeUri, `${RDFS}label`, null);
  const label = labelQuads[0]?.value ?? localName(shapeUri);

  const propertyRefs = store.getObjects(shapeUri, `${SH}property`, null);
  const requiredProperties: PropertyConstraint[] = [];
  const optionalProperties: PropertyConstraint[] = [];

  for (const propRef of propertyRefs) {
    const constraint = extractPropertyConstraint(store, propRef.value);
    if (!constraint) continue;
    if (constraint.minCount > 0) {
      requiredProperties.push(constraint);
    } else {
      optionalProperties.push(constraint);
    }
  }

  return { uri: shapeUri, label, requiredProperties, optionalProperties };
}

/**
 * Reads a SHACL property node and returns its constraint details.
 *
 * @param store - N3 Store with parsed quads
 * @param propUri - URI of the property node
 * @returns Property constraint, or null if no path is found
 *
 * @internal
 */
function extractPropertyConstraint(store: N3Store, propUri: string): PropertyConstraint | null {
  const pathQuads = store.getObjects(propUri, `${SH}path`, null);
  const path = pathQuads[0]?.value;
  if (!path) return null;

  const minCount = store.getObjects(propUri, `${SH}minCount`, null)[0]
    ? parseInt(store.getObjects(propUri, `${SH}minCount`, null)[0].value, 10)
    : 0;
  const datatype = store.getObjects(propUri, `${SH}datatype`, null)[0]?.value ?? "";
  const nodeKind = store.getObjects(propUri, `${SH}nodeKind`, null)[0]?.value ?? "";
  const label = store.getObjects(propUri, `${SH}name`, null)[0]?.value ?? localName(path);
  const description = store.getObjects(propUri, `${SH}description`, null)[0]?.value ?? "";

  return { path, localName: localName(path), label, description, minCount, datatype, nodeKind };
}

/**
 * Extracts the last segment of a URI (after '/' or '#').
 *
 * @param uri - Full URI
 * @returns Local name portion
 *
 * @internal
 */
function localName(uri: string): string {
  const index = Math.max(uri.lastIndexOf("#"), uri.lastIndexOf("/"));
  return index >= 0 ? uri.substring(index + 1) : uri;
}
