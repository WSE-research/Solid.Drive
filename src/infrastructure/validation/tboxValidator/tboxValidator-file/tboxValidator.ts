/**
 * TBox-based metadata validation.
 *
 * @remarks
 * Loads SHACL shape definitions and validates metadata against required properties.
 *
 * @packageDocumentation
 */

import type { FetchFn } from "@/types";
import { DEFAULT_TBOX_PATH } from "@/config";
import { parseTBox } from "../../tboxParser";
import type {
  PropertyConstraint,
  ShapeDefinition,
  ValidationResult,
  PropertyViolation,
} from "../../tboxTypes";

export type { PropertyConstraint, ShapeDefinition, ValidationResult, PropertyViolation };
export { parseTBox } from "../../tboxParser";

let cachedShapes: Map<string, ShapeDefinition> | null = null;
let cachedParents: Map<string, string[]> | null = null;

/**
 * Resets cached TBox data so the next load fetches fresh data.
 *
 * @public
 */
export function resetTBoxCache(): void {
  cachedShapes = null;
  cachedParents = null;
}

/**
 * Fetches and parses the TBox file, then caches the result.
 *
 * @remarks
 * Returns cached data if already loaded.
 *
 * @param tboxUri - URI of the TBox file
 * @param fetchFn - Fetch function to use
 * @returns Object with shapes map and parents map
 *
 * @public
 */
export async function loadTBox(
  tboxUri: string = DEFAULT_TBOX_PATH,
  fetchFn: FetchFn = fetch
): Promise<{ shapes: Map<string, ShapeDefinition>; parents: Map<string, string[]> }> {
  if (cachedShapes && cachedParents) {
    return { shapes: cachedShapes, parents: cachedParents };
  }

  const response = await fetchFn(tboxUri);
  if (!response.ok) {
    throw new Error(`Failed to load TBox from ${tboxUri}: ${response.status} ${response.statusText}`);
  }

  const result = parseTBox(await response.text());
  cachedShapes = result.shapes;
  cachedParents = result.parents;
  return result;
}

/**
 * Collects a type and all its parent types via `rdfs:subClassOf`.
 *
 * @param typeUri - Starting type URI
 * @param parents - Map of type to parent types
 * @returns Array of all ancestor URIs including the starting type
 *
 * @internal
 */
function collectAncestors(typeUri: string, parents: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const queue = [typeUri];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const parent of parents.get(current) ?? []) {
      if (!visited.has(parent)) queue.push(parent);
    }
  }

  return [...visited];
}

/**
 * Builds a full shape for a type by merging its own shape with all inherited shapes.
 *
 * @param typeUri - URI of the type
 * @param shapes - Map of shape definitions
 * @param parents - Map of type to parent types
 * @returns Merged shape definition, or null if no shapes apply
 *
 * @public
 */
export function getShapeForType(
  typeUri: string,
  shapes: Map<string, ShapeDefinition>,
  parents: Map<string, string[]>
): ShapeDefinition | null {
  const applicableShapes = collectAncestors(typeUri, parents)
    .map((uri) => shapes.get(uri))
    .filter((shape): shape is ShapeDefinition => shape !== undefined);

  if (applicableShapes.length === 0) return null;

  const requiredByPath = new Map<string, PropertyConstraint>();
  const optionalByPath = new Map<string, PropertyConstraint>();

  for (const shape of applicableShapes) {
    for (const prop of shape.requiredProperties) {
      if (!requiredByPath.has(prop.path)) requiredByPath.set(prop.path, prop);
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
 * Validates metadata against required properties of a type.
 *
 * @remarks
 * Returns missing required fields as violations.
 *
 * @param metadata - Key-value metadata to validate
 * @param typeUri - URI of the type to validate against
 * @param shapes - Map of shape definitions
 * @param parents - Map of type to parent types
 * @returns Validation result with violations and shape
 *
 * @public
 */
export function validateMetadata(
  metadata: Record<string, unknown>,
  typeUri: string,
  shapes: Map<string, ShapeDefinition>,
  parents: Map<string, string[]>
): ValidationResult {
  const shape = getShapeForType(typeUri, shapes, parents);
  if (!shape) return { valid: true, violations: [], shape: null };

  const violations: PropertyViolation[] = shape.requiredProperties
    .filter((required) => !hasProperty(metadata, required))
    .map((required) => ({
      path: required.path,
      localName: required.localName,
      label: required.label,
      description: required.description,
      minCount: required.minCount,
    }));

  return { valid: violations.length === 0, violations, shape };
}

/**
 * Checks if metadata contains a non-empty value for a property constraint.
 *
 * @internal
 */
function hasProperty(metadata: Record<string, unknown>, constraint: PropertyConstraint): boolean {
  return isNonEmpty(metadata[constraint.localName]) || isNonEmpty(metadata[constraint.path]);
}

/**
 * Returns true if a value is present and not empty.
 *
 * @internal
 */
function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object" && "@id" in (value as Record<string, unknown>)) {
    return !!(value as { "@id": string })["@id"];
  }
  if (typeof value === "object" && "toArray" in (value as Record<string, unknown>)) {
    return (value as { toArray: () => unknown[] }).toArray().length > 0;
  }
  return true;
}
