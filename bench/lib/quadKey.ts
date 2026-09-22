/**
 * @packageDocumentation
 * Shared by the write-method equivalence tests: turns an RDF quad into an
 * order-independent string key, so two quad sets built by two different write
 * paths can be compared for equality regardless of triple order.
 */

export interface QuadLike {
  subject: { value: string };
  predicate: { value: string };
  object: { termType: string; value: string; datatype?: { value: string }; language?: string };
}

/** A quad as an order-independent string key, so two quad sets can be compared ignoring order. */
export function quadKey(quad: QuadLike): string {
  const object = quad.object;
  const objectPart = object.termType === "Literal"
    ? `"${object.value}"^^${object.datatype?.value ?? ""}@${object.language ?? ""}`
    : `<${object.value}>`;
  return `<${quad.subject.value}> <${quad.predicate.value}> ${objectPart}`;
}

/** Quads as a sorted array of order-independent keys, so two quad sets can be compared regardless of order. */
export function sortedQuadKeys(quads: unknown[]): string[] {
  return (quads as QuadLike[]).map(quadKey).sort();
}
