/**
 * @packageDocumentation
 * Builds the N3 Patch for the PATCH approach in the write-method experiment:
 * adding a catalog entry with a single PATCH instead of the app's usual
 * GET+PUT.
 *
 * The PUT approach reuses the app's own `appendToCatalog`, so this module
 * inserts the identical DCAT triples in one PATCH, keeping the write method
 * as the only variable between the two. `buildN3Patch.test.ts` checks the
 * generated triples against `appendToCatalog`'s output, so any mismatch between
 * them fails the test. 
 * 
 * The app's soft-delete feature still writes the catalog with plain GET+PUT; 
 * this PATCH approach exists only for the benchmark.
 */

import { SOLID_NS, DCAT_NS, DCTERMS_NS, XSD_NS, SD_NS, DISTRIBUTION_FRAGMENT } from "./rdfNamespaces";

/**
 * The fields of a single catalog append, matching `AppendFileEntryParams`
 * so both write-method approaches take the same input.
 *
 * @public
 */
export interface CatalogAppend {
  catalogUri: string;
  instanceUri: string;
  binaryUri: string;
  classUri: string;
  mediaType: string;
  byteSize: number;
  title: string;
  description: string;
  modified: string;
  publisherWebId: string;
  parentUri?: string;
}

/**
 * Ensures that a URI can be safely used in N3 interpolation.
 * 
 * Since our path is defined by hand for the benchmark, we'll need a sanity check to 
 * avoid accidental injection of a triple that would break the patch.
 * @param uri - The URI to check.
 * @throws Error if the URI contains unsafe characters.
 */
function assertSafeUri(uri: string): void {
  if (/[>\s]/.test(uri)) throw new Error(`Unsafe URI rejected for N3 interpolation: "${uri}"`);
}

// Escapes a string for use as a double-quoted Turtle/N3 literal.
function escapeLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Builds the N3 Patch document for one catalog append.
 *
 * @param entry - The dataset to insert, matching the shape of `appendToCatalog`'s args.
 * @returns A `text/n3` patch body ready to PATCH at the catalog URI.
 *
 * @public
 */
export function buildN3Patch(entry: CatalogAppend): string {
  const {
    catalogUri, instanceUri, binaryUri, classUri,
    mediaType, byteSize, title, description, modified, publisherWebId, parentUri,
  } = entry;

  for (const uri of [catalogUri, instanceUri, binaryUri, classUri, publisherWebId]) {
    assertSafeUri(uri);
  }
  if (parentUri) assertSafeUri(parentUri);

  const distribution = `${instanceUri}${DISTRIBUTION_FRAGMENT}`;

  const inserts: string[] = [
    `<${catalogUri}> dcat:dataset <${instanceUri}> .`,
    `<${instanceUri}> a dcat:Dataset .`,
    `<${instanceUri}> a sd:File .`,
    `<${instanceUri}> dcterms:conformsTo <${classUri}> .`,
    `<${instanceUri}> dcterms:title "${escapeLiteral(title)}" .`,
  ];

  if (description.trim()) {
    inserts.push(`<${instanceUri}> dcterms:description "${escapeLiteral(description)}" .`);
  }

  inserts.push(
    `<${instanceUri}> dcterms:modified "${escapeLiteral(modified)}"^^xsd:dateTime .`,
    `<${instanceUri}> dcterms:publisher <${publisherWebId}> .`,
  );

  if (parentUri) {
    inserts.push(`<${instanceUri}> sd:hasParent <${parentUri}> .`);
  }

  inserts.push(
    `<${instanceUri}> dcat:distribution <${distribution}> .`,
    `<${distribution}> a dcat:Distribution .`,
    `<${distribution}> dcat:accessURL <${binaryUri}> .`,
    `<${distribution}> dcat:mediaType "${escapeLiteral(mediaType)}" .`,
    `<${distribution}> dcat:byteSize "${byteSize}"^^xsd:integer .`,
  );

  const insertBlock = inserts.map((triple) => `    ${triple}`).join("\n");

  return `@prefix solid: <${SOLID_NS}> .
@prefix dcat: <${DCAT_NS}> .
@prefix dcterms: <${DCTERMS_NS}> .
@prefix xsd: <${XSD_NS}> .
@prefix sd: <${SD_NS}> .

_:patch a solid:InsertDeletePatch ;
  solid:inserts {
${insertBlock}
  } .
`;
}
