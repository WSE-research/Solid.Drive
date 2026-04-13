/**
 * Type definitions for TBox validation.
 *
 * @packageDocumentation
 */

/**
 * Constraint for a single property in a SHACL shape.
 *
 * @public
 */
export interface PropertyConstraint {
  /** Full URI path of the property. */
  path: string;
  /** Local name extracted from the path. */
  localName: string;
  /** Human-readable label. */
  label: string;
  /** Description of the property. */
  description: string;
  /** Minimum required occurrences (0 = optional). */
  minCount: number;
  /** Expected datatype URI. */
  datatype: string;
  /** SHACL node kind constraint. */
  nodeKind: string;
}

/**
 * Definition of a SHACL NodeShape.
 *
 * @public
 */
export interface ShapeDefinition {
  /** URI of the shape. */
  uri: string;
  /** Human-readable label. */
  label: string;
  /** Properties with minCount > 0. */
  requiredProperties: PropertyConstraint[];
  /** Properties with minCount = 0. */
  optionalProperties: PropertyConstraint[];
}

/**
 * Result of validating metadata against a shape.
 *
 * @public
 */
export interface ValidationResult {
  /** True if all required properties are present. */
  valid: boolean;
  /** List of missing required properties. */
  violations: PropertyViolation[];
  /** The shape used for validation, or null if none found. */
  shape: ShapeDefinition | null;
}

/**
 * A missing required property from validation.
 *
 * @public
 */
export interface PropertyViolation {
  /** Full URI path of the missing property. */
  path: string;
  /** Local name extracted from the path. */
  localName: string;
  /** Human-readable label. */
  label: string;
  /** Description of the property. */
  description: string;
  /** Required minimum count. */
  minCount: number;
}
