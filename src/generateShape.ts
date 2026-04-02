import N3 from "n3";

// Split an IRI into namespace and local name using the last '#' or '/'
function splitIri(iri: string): { namespace: string; localName: string } | null {
  const index = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
  if (index < 0) return null;
  return { namespace: iri.substring(0, index + 1), localName: iri.substring(index + 1) };
}

// Get the local name from an IRI, or return the original if it can't be split
function getLocalName(iri: string): string {
  return splitIri(iri)?.localName ?? iri;
}

// Build a namespace-to-prefix map for quick IRI abbreviation
function buildNamespaceToPrefixMap(prefixes: Record<string, string>): Map<string, string> {
  const namespaceToPrefix = new Map<string, string>();
  for (const [key, value] of Object.entries(prefixes)) namespaceToPrefix.set(value, key);
  return namespaceToPrefix;
}

// Match an IRI to a known prefix and return "prefix + local name"
function getPrefixForIri(
  iri: string,
  namespaceToPrefixMap: Map<string, string>
): { prefix: string; localName: string } | null {
  const iriParts = splitIri(iri);
  if (!iriParts) return null;
  const prefix = namespaceToPrefixMap.get(iriParts.namespace);
  return prefix != null ? { prefix, localName: iriParts.localName } : null;
}

// Extract @prefix mappings from Turtle text for early IRI abbreviation.
function parsePrefixes(turtleText: string): Record<string, string> {
  const prefixes: Record<string, string> = {};
  const prefixRegex = /@prefix\s+(\w*):\s*<([^>]+)>/g;
  let match;
  while ((match = prefixRegex.exec(turtleText)) !== null) {
    prefixes[match[1]] = match[2];
  }
  return prefixes;
}

export interface DiscoveredProperty {
  predicate: string;
  types: Set<string>;
  occurrences: number;
  totalSubjects: number;
}

export interface DiscoveredShape {
  typeName: string;                 // e.g. "dcat:Dataset"
  properties: DiscoveredProperty[];
}

// Parse the Turtle data once, then build shape summaries from the parsed quads
export function discoverShapesFromTurtle(turtleText: string): DiscoveredShape[] {
  const parser = new N3.Parser();
  let quads: N3.Quad[];
  try {
    quads = parser.parse(turtleText);
  } catch {
    return [];
  }
  const namespaceToPrefixMap = buildNamespaceToPrefixMap(parsePrefixes(turtleText));
  const rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

  // Per subject, keep:
  // - its declared rdf:types
  // - its predicates, value types, and occurrence counts
  const subjectTypes = new Map<string, Set<string>>();
  type PredEntry = { types: Set<string>; count: number };
  const subjectProps = new Map<string, Map<string, PredEntry>>();

  for (const quad of quads) {
    const subject = quad.subject.value;
    const predicate = quad.predicate.value;

    if (predicate === rdfType) {
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
