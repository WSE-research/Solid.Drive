/**
 * @packageDocumentation
 * Utilities for serializing RDF quads to Turtle.
 */

import { Writer } from "n3";
import type { Quad } from "n3";

/**
 * Converts N3 quads to a Turtle string.
 *
 * @param quads - Array of RDF quads to serialize
 * @param prefixes - Optional prefix map for the output
 *
 * @public
 */
export function serializeTurtle(quads: Quad[], prefixes: Record<string, string> = {}): string {
  let turtle = "";
  const writer = new Writer({ prefixes });
  writer.addQuads(quads);
  writer.end((_err, result) => {
    turtle = result;
  });
  return turtle;
}
