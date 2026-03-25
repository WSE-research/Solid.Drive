import { Parser as N3Parser, Store as N3Store } from "n3";
import type { FetchFn } from "./podCatalog";

const SH = "http://www.w3.org/ns/shacl#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";

const DEFAULT_TBOX_URI = "/tbox.ttl";

export interface PropertyConstraint {
  path: string;
  localName: string;
  label: string;
  description: string;
  minCount: number;
  datatype: string;
  nodeKind: string;
}

export interface ShapeDefinition {
  uri: string;
  label: string;
  requiredProperties: PropertyConstraint[];
  optionalProperties: PropertyConstraint[];
}

export interface ValidationResult {
  valid: boolean;
  violations: PropertyViolation[];
  shape: ShapeDefinition | null;
}

export interface PropertyViolation {
  path: string;
  localName: string;
  label: string;
  description: string;
  minCount: number;
}

let cachedShapes: Map<string, ShapeDefinition> | null = null;
let cachedParents: Map<string, string[]> | null = null;

// Reset cached TBox data so the next load fetches fresh data
export function resetTBoxCache(): void {
  cachedShapes = null;
  cachedParents = null;
}

/**
 * Fetch and parse the TBox file, then cache the result
 * Returns cached data if already loaded
 */
export async function loadTBox(
  tboxUri: string = DEFAULT_TBOX_URI,
  fetchFn: FetchFn = fetch
): Promise<{ shapes: Map<string, ShapeDefinition>; parents: Map<string, string[]> }> {
  if (cachedShapes && cachedParents) {
    return { shapes: cachedShapes, parents: cachedParents };
  }

  const response = await fetchFn(tboxUri);
  if (!response.ok) {
    throw new Error(`Failed to load TBox from ${tboxUri}: ${response.status} ${response.statusText}`);
  }
  const turtle = await response.text();

  const result = parseTBox(turtle);
  cachedShapes = result.shapes;
  cachedParents = result.parents;
  return result;
}

/**
 * Convert a Turtle string into shape definitions and a parent map
 * Does not perform any I/O
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
  const nodeShapeUris = new Set(nodeShapeQuads.map((q) => q.subject.value));

  const subClassQuads = store.getQuads(null, `${RDFS}subClassOf`, null, null);
  for (const quad of subClassQuads) {
    const child = quad.subject.value;
    const parent = quad.object.value;
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child)!.push(parent);
  }

  for (const shapeUri of nodeShapeUris) {
    const shape = extractShape(store, shapeUri);
    if (shape) {
      shapes.set(shapeUri, shape);
    }
  }

  return { shapes, parents };
}

/**
 * Build a shape definition from a NodeShape URI
 * Splits properties into required and optional
 */
function extractShape(store: N3Store, shapeUri: string): ShapeDefinition | null {

  const labelQuads = store.getObjects(shapeUri, `${RDFS}label`, null);
  const label = labelQuads[0]?.value ?? localName(shapeUri);

  const propertyRefs = store.getObjects(shapeUri, `${SH}property`, null);

  const requiredProperties: PropertyConstraint[] = [];
  const optionalProperties: PropertyConstraint[] = [];

  for (const propRef of propertyRefs) {
    const propUri = propRef.value;
    const constraint = extractPropertyConstraint(store, propUri);
    if (!constraint) continue;

    if (constraint.minCount > 0) {
      requiredProperties.push(constraint);
    } else {
      optionalProperties.push(constraint);
    }
  }

  return {
    uri: shapeUri,
    label,
    requiredProperties,
    optionalProperties,
  };
}

/**
 * Read a SHACL property node and return its constraint details
 * Returns null if no path is defined
 */
function extractPropertyConstraint(store: N3Store, propUri: string): PropertyConstraint | null {

  const pathQuads = store.getObjects(propUri, `${SH}path`, null);
  const path = pathQuads[0]?.value;
  if (!path) return null;

  const minCountQuads = store.getObjects(propUri, `${SH}minCount`, null);
  const minCount = minCountQuads[0] ? parseInt(minCountQuads[0].value, 10) : 0;

  const datatypeQuads = store.getObjects(propUri, `${SH}datatype`, null);
  const datatype = datatypeQuads[0]?.value ?? "";

  const nodeKindQuads = store.getObjects(propUri, `${SH}nodeKind`, null);
  const nodeKind = nodeKindQuads[0]?.value ?? "";

  const nameQuads = store.getObjects(propUri, `${SH}name`, null);
  const label = nameQuads[0]?.value ?? localName(path);

  const descQuads = store.getObjects(propUri, `${SH}description`, null);
  const description = descQuads[0]?.value ?? "";

  return {
    path,
    localName: localName(path),
    label,
    description,
    minCount,
    datatype,
    nodeKind,
  };
}


// Extract the last segment of a URI (after '/' or '#')
function localName(uri: string): string {
  const hash = uri.lastIndexOf("#");
  const slash = uri.lastIndexOf("/");
  const index = Math.max(hash, slash);
  return index >= 0 ? uri.substring(index + 1) : uri;
}


//Collect a type and all its parent types via rdfs:subClassOf
function collectAncestors(
  typeUri: string,
  parents: Map<string, string[]>
): string[] {
  const visited = new Set<string>();
  const queue = [typeUri];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const parentTypes = parents.get(current) ?? [];
    for (const parent of parentTypes) {
      if (!visited.has(parent)) {
        queue.push(parent);
      }
    }
  }

  return [...visited];
}

/**
 * Build a full shape for a type by merging its own shape
 * with all inherited shapes
 */
export function getShapeForType(
  typeUri: string,
  shapes: Map<string, ShapeDefinition>,
  parents: Map<string, string[]>
): ShapeDefinition | null {
  const ancestors = collectAncestors(typeUri, parents);

  const applicableShapes = ancestors
    .map((uri) => shapes.get(uri))
    .filter((s): s is ShapeDefinition => s !== undefined);

  if (applicableShapes.length === 0) return null;

  const requiredByPath = new Map<string, PropertyConstraint>();
  const optionalByPath = new Map<string, PropertyConstraint>();

  for (const shape of applicableShapes) {
    for (const prop of shape.requiredProperties) {
      if (!requiredByPath.has(prop.path)) {
        requiredByPath.set(prop.path, prop);
      }
    }
    for (const prop of shape.optionalProperties) {
      if (!optionalByPath.has(prop.path) && !requiredByPath.has(prop.path)) {
        optionalByPath.set(prop.path, prop);
      }
    }
  }

  return {
    uri: typeUri,
    label: applicableShapes[0].label,
    requiredProperties: [...requiredByPath.values()],
    optionalProperties: [...optionalByPath.values()],
  };
}

/**
 * Check metadata against required properties of a type
 * Returns missing required fields as violations
 */
export function validateMetadata(
  metadata: Record<string, unknown>,
  typeUri: string,
  shapes: Map<string, ShapeDefinition>,
  parents: Map<string, string[]>
): ValidationResult {
  const shape = getShapeForType(typeUri, shapes, parents);

  if (!shape) {
    return { valid: true, violations: [], shape: null };
  }

  const violations: PropertyViolation[] = [];

  for (const required of shape.requiredProperties) {
    if (!hasProperty(metadata, required)) {
      violations.push({
        path: required.path,
        localName: required.localName,
        label: required.label,
        description: required.description,
        minCount: required.minCount,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    shape,
  };
}

/**
 * Check if metadata contains a value for a property
 * Supports local names, full URIs, and object values
 */
function hasProperty(
  metadata: Record<string, unknown>,
  constraint: PropertyConstraint
): boolean {

  const byLocal = metadata[constraint.localName];
  if (isNonEmpty(byLocal)) return true;

  const byUri = metadata[constraint.path];
  if (isNonEmpty(byUri)) return true;

  return false;
}

// Return true if a value is present and not empty
function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object" && "@id" in (value as Record<string, unknown>)) {
    return !!(value as { "@id": string })["@id"];
  }

  if (typeof value === "object" && "toArray" in (value as Record<string, unknown>)) {
    const arr = (value as { toArray: () => unknown[] }).toArray();
    return arr.length > 0;
  }
  return true;
}
