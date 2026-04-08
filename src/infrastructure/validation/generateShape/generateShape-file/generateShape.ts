/**
 * Shape discovery from Turtle data.
 *
 * @remarks
 * Analyzes RDF data to discover type shapes and property usage patterns.
 *
 * @packageDocumentation
 */

import N3 from "n3";
import { RDF_TYPE_URI } from "@/config";

/**
 * Splits an IRI into namespace and local name using the last '#' or '/'.
 *
 * @param iri - The IRI to split
 * @returns Object with namespace and localName, or null if cannot be split
 *
 * @internal
 */
function splitIri(iri: string): { namespace: string; localName: string } | null {
  const index = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
  if (index < 0) return null;
  return { namespace: iri.substring(0, index + 1), localName: iri.substring(index + 1) };
}

/**
 * Gets the local name from an IRI, or returns the original if it cannot be split.
 *
 * @internal
 */
function getLocalName(iri: string): string {
  return splitIri(iri)?.localName ?? iri;
}

/**
 * Builds a namespace-to-prefix map for quick IRI abbreviation.
 *
 * @internal
 */
function buildNamespaceToPrefixMap(prefixes: Record<string, string>): Map<string, string> {
  const namespaceToPrefix = new Map<string, string>();
  for (const [key, value] of Object.entries(prefixes)) namespaceToPrefix.set(value, key);
  return namespaceToPrefix;
}

/**
 * Matches an IRI to a known prefix and returns "prefix + local name".
 *
 * @internal
 */
function getPrefixForIri(
  iri: string,
  namespaceToPrefixMap: Map<string, string>
): { prefix: string; localName: string } | null {
  const iriParts = splitIri(iri);
  if (!iriParts) return null;
  const prefix = namespaceToPrefixMap.get(iriParts.namespace);
  return prefix != null ? { prefix, localName: iriParts.localName } : null;
}

/**
 * Extracts @prefix mappings from Turtle text for early IRI abbreviation.
 *
 * @internal
 */
function parsePrefixes(turtleText: string): Record<string, string> {
  const prefixes: Record<string, string> = {};
  const prefixRegex = /@prefix\s+(\w*):\s*<([^>]+)>/g;
  let match;
  while ((match = prefixRegex.exec(turtleText)) !== null) {
    prefixes[match[1]] = match[2];
  }
  return prefixes;
}

/**
 * A discovered property from RDF data analysis.
 *
 * @public
 */
export interface DiscoveredProperty {
  /** Full predicate URI. */
  predicate: string;
  /** Set of value types observed (e.g., "IRI", "xsd:string"). */
  types: Set<string>;
  /** Total number of times this property appeared. */
  occurrences: number;
  /** Number of subjects that had this property. */
  totalSubjects: number;
}

/**
 * A discovered shape summarizing a type's properties.
 *
 * @public
 */
export interface DiscoveredShape {
  /** Prefixed type name (e.g., "dcat:Dataset"). */
  typeName: string;
  /** Properties discovered for this type. */
  properties: DiscoveredProperty[];
}

/**
 * Parses Turtle data and builds shape summaries from the parsed quads.
 *
 * @remarks
 * Analyzes RDF data to discover what properties are used with each type.
 *
 * @param turtleText - Raw Turtle content
 * @returns Array of discovered shapes
 *
 * @public
 */
export function discoverShapesFromTurtle(turtleText: string): DiscoveredShape[] {
  const parser = new N3.Parser();
  let quads: N3.Quad[];
  try {
    quads = parser.parse(turtleText);
  } catch {
    return [];
  }
  const namespaceToPrefixMap = buildNamespaceToPrefixMap(parsePrefixes(turtleText));

  // Per subject, keep:
  // - its declared rdf:types
  // - its predicates, value types, and occurrence counts
  const subjectTypes = new Map<string, Set<string>>();
  type PredEntry = { types: Set<string>; count: number };
  const subjectProps = new Map<string, Map<string, PredEntry>>();

  for (const quad of quads) {
    const subject = quad.subject.value;
    const predicate = quad.predicate.value;

    if (predicate === RDF_TYPE_URI) {
      if (quad.object.termType === "NamedNode") {
        if (!subjectTypes.has(subject)) subjectTypes.set(subject, new Set());
        subjectTypes.get(subject)!.add(quad.object.value);
      }
      continue;
    }

    // Classify value type
    let typeLabel: string;
    if (quad.object.termType === "NamedNode") {
      typeLabel = "IRI";
    } else if (quad.object.termType === "Literal" && quad.object.datatype) {
      const datatypePrefix = getPrefixForIri(quad.object.datatype.value, namespaceToPrefixMap);
      typeLabel = datatypePrefix ? `${datatypePrefix.prefix}:${datatypePrefix.localName}` : `xsd:${getLocalName(quad.object.datatype.value)}`;
    } else {
      typeLabel = "xsd:string";
    }

    if (!subjectProps.has(subject)) subjectProps.set(subject, new Map());
    const props = subjectProps.get(subject)!;
    if (!props.has(predicate)) props.set(predicate, { types: new Set(), count: 0 });
    const entry = props.get(predicate)!;
    entry.types.add(typeLabel);
    entry.count++;
  }

  // Aggregate per type: merge predicate records from all subjects of that type
  type TypeAggregation = { subjects: Set<string>; preds: Map<string, PredEntry> };
  const typeAggregations = new Map<string, TypeAggregation>();

  for (const [subject, types] of subjectTypes) {
    const props = subjectProps.get(subject);
    for (const typeIri of types) {
      if (!typeAggregations.has(typeIri)) typeAggregations.set(typeIri, { subjects: new Set(), preds: new Map() });
      const agg = typeAggregations.get(typeIri)!;
      agg.subjects.add(subject);
      if (props) {
        for (const [predicate, { types: valTypes, count }] of props) {
          if (!agg.preds.has(predicate)) agg.preds.set(predicate, { types: new Set(), count: 0 });
          const aggPred = agg.preds.get(predicate)!;
          for (const t of valTypes) aggPred.types.add(t);
          aggPred.count += count;
        }
      }
    }
  }

  // Build output
  const shapes: DiscoveredShape[] = [];
  for (const [typeIri, { subjects, preds }] of typeAggregations) {
    const type = getPrefixForIri(typeIri, namespaceToPrefixMap);
    const typeName = type ? `${type.prefix}:${type.localName}` : getLocalName(typeIri);

    const properties: DiscoveredProperty[] = [];
    for (const [predicate, { types, count }] of preds) {
      properties.push({ predicate, types, occurrences: count, totalSubjects: subjects.size });
    }

    shapes.push({ typeName, properties });
  }

  return shapes;
}
