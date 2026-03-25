/**
 * Builds a reduced SHACL TBox from https://datashapes.org/schema.ttl.
 * It keeps only the shapes used by solid.drive and merges app specific cardinality constraints.
 *
 * Writes the result to public/tbox.ttl so the generated TBox stays in sync
 * with the source and is never edited by hand.
 *
 * Usage:
 *   node scripts/extract-tbox.mjs
 *   node scripts/extract-tbox.mjs --source https://datashapes.org/schema.ttl
 *   node scripts/extract-tbox.mjs --output public/tbox.ttl
 */

import { Parser, Store, Writer, DataFactory } from "n3";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const SOURCE_URL = getArg("source", "https://datashapes.org/schema.ttl");
const OUTPUT_PATH = getArg("output", resolve(__dirname, "../public/tbox.ttl"));
const CARDINALITY_PATH = getArg("cardinality", resolve(__dirname, "./tbox-cardinality.ttl"));

// Types to extract 
const TARGET_TYPES = [
  "http://schema.org/DigitalDocument",
  "http://schema.org/MediaObject",
  "http://schema.org/ImageObject",
  "http://schema.org/VideoObject",
  "http://schema.org/AudioObject",
  "http://schema.org/TextDigitalDocument",
  "http://schema.org/SpreadsheetDigitalDocument",
  "http://schema.org/CreativeWork",
  "http://schema.org/Thing",
];


async function main() {
  console.log(`[tbox] fetching ${SOURCE_URL} ...`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch TBox: ${response.status} ${response.statusText}`);
  }
  const turtle = await response.text();
  console.log(`[tbox] received ${(turtle.length / 1024).toFixed(0)} KB of Turtle`);

  const quads = new Parser().parse(turtle);
  const store = new Store(quads);
  console.log(`[tbox] parsed ${quads.length} triples`);

  // Keep target shapes and any ancestor shapes that are also declared as NodeShapes
  const shapeUris = new Set();
  for (const typeUri of TARGET_TYPES) {
    if (
        store.getQuads(
          typeUri, 
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", 
          "http://www.w3.org/ns/shacl#NodeShape", 
          null
        ).length > 0
      ) {
      shapeUris.add(typeUri);
    }
  }

  const ancestors = collectAncestors(TARGET_TYPES, store);
  for (const ancestor of ancestors) {
    if (
        store.getQuads(
          ancestor, 
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", 
          "http://www.w3.org/ns/shacl#NodeShape", 
          null).length > 0
        ) {
      shapeUris.add(ancestor);
    }
  }

  console.log(`[tbox] collected ${shapeUris.size} shapes (including ancestors)`);

  const SH = "http://www.w3.org/ns/shacl#";
  const propertyShapeUris = new Set();

  // Collect named property shapes referenced by the selected node shapes
  for (const shapeUri of shapeUris) {
    const propRefs = store.getObjects(shapeUri, `${SH}property`, null);
    for (const ref of propRefs) {
      // Only include named property shapes from schema.org
      if (ref.value.startsWith("http://schema.org/")) {
        propertyShapeUris.add(ref.value);
      }
    }
  }

  // Filter to only the properties our app actually uses.
  const USED_PROPERTIES = [
    "name",
    "description",
    "encodingFormat",
    "contentSize",
    "uploadDate",
    "publisher",
    "dateModified",
    "isPartOf",
    "sharedWith",
  ];

  const filteredPropertyUris = new Set();
  for (const propUri of propertyShapeUris) {
    if (USED_PROPERTIES.includes(extractPropertyName(propUri))) {
      filteredPropertyUris.add(propUri);
    }
  }

  console.log(`[tbox] kept ${filteredPropertyUris.size} property shapes (of ${propertyShapeUris.size} total)`);

  // Ensure every extracted shape exposes every property the app expects,
  // even when the upstream schema only defines that property on some shapes
  const { namedNode, quad: makeQuad } = DataFactory;

  // Map each property name to the property shapes that define it
  const propNameToShapeUris = new Map();
  for (const propUri of filteredPropertyUris) {
    const propName = extractPropertyName(propUri);
    if (!propNameToShapeUris.has(propName)) propNameToShapeUris.set(propName, []);
    propNameToShapeUris.get(propName).push(propUri);
  }

  // Track which properties each shape already references
  const shapeToProps = new Map();
  for (const shapeUri of shapeUris) {
    const propRefs = store.getObjects(shapeUri, `${SH}property`, null);
    const propNames = new Set();
    for (const ref of propRefs) {
      propNames.add(extractPropertyName(ref.value));
    }
    shapeToProps.set(shapeUri, propNames);
  }

  // Add missing property references using the first matching property shape
  const augQuads = [];
  for (const shapeUri of shapeUris) {
    const existingProps = shapeToProps.get(shapeUri);
    for (const propName of USED_PROPERTIES) {
      if (!existingProps.has(propName) && propNameToShapeUris.has(propName)) {
        const propShapeUri = propNameToShapeUris.get(propName)[0];
        augQuads.push(
          makeQuad(namedNode(shapeUri), namedNode(`${SH}property`), namedNode(propShapeUri))
        );
        console.log(`[tbox] augmented ${shapeUri.split("/").pop()} with ${propName} → ${propShapeUri.split("/").pop()}`);
      }
    }
  }

  console.log(`[tbox] added ${augQuads.length} augmented property references`);

  const outputQuads = [];

  // Copy the selected shape metadata and keep only references to retained properties
  for (const shapeUri of shapeUris) {
    outputQuads.push(
      ...store.getQuads(
          shapeUri, 
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", 
          null, 
          null
        )
        .filter(quad => quad.object.value === `${SH}NodeShape`));

    // rdf:type rdfs:Class
    outputQuads.push(
      ...store.getQuads(
        shapeUri, 
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", 
        "http://www.w3.org/2000/01/rdf-schema#Class", 
        null)
      );

    // rdfs:label
    outputQuads.push(
      ...store.getQuads(
        shapeUri, 
        "http://www.w3.org/2000/01/rdf-schema#label", 
        null, 
        null)
      );

    // rdfs:subClassOf
    outputQuads.push(
      ...store.getQuads(
        shapeUri, 
        "http://www.w3.org/2000/01/rdf-schema#subClassOf", 
        null, 
        null)
      );

    // sh:property —> only for filtered property shapes
    for (const propUri of filteredPropertyUris) {
      const refs = store.getQuads(shapeUri, `${SH}property`, propUri, null);
      if (refs.length > 0) {
        outputQuads.push(...refs);
      }
    }
  }

  // Copy the retained property shape definitions and their metadata
  // Skip sh:or — its blank node list structures are not copied and would dangle
  for (const propUri of filteredPropertyUris) {
    outputQuads.push(
      ...store.getQuads(propUri, null, null, null).filter(
        (quad) => quad.predicate.value !== `${SH}or`
      )
    );
  }

  // Append synthetic property references added for app compatibility
  outputQuads.push(...augQuads);

  console.log(`[tbox] extracted ${outputQuads.length} triples from source`);

  // Load local cardinality overrides, if present
  let cardinalityTurtle = "";
  try {
    cardinalityTurtle = readFileSync(CARDINALITY_PATH, "utf-8");
    console.log(`[tbox] loading app cardinality from ${CARDINALITY_PATH}`);
  } catch {
    console.log(`[tbox] no cardinality file at ${CARDINALITY_PATH}, skipping`);
  }

  const turtle_output = await new Promise((resolve, reject) => {
    const writer = new Writer({
      prefixes: {
        sh: SH,
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        schema: "http://schema.org/",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });
    writer.addQuads(outputQuads);
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  // Prefix the generated content with provenance metadata, then append local overrides
  const header = [
    "# ┌──────────────────────────────────────────────────────────────────────┐",
    "# │ This file is AUTO-GENERATED by scripts/extract-tbox.mjs              │",
    "# │ Source: https://datashapes.org/schema.ttl                            │",
    "# │ DO NOT EDIT — run the script to regenerate.                          │",
    "# └──────────────────────────────────────────────────────────────────────┘",
    "",
    `<https://w3id.org/solid-drive/tbox>`,
    `  <http://www.w3.org/2002/07/owl#imports> <https://datashapes.org/schema> ;`,
    `  <http://www.w3.org/2000/01/rdf-schema#comment> "Auto-extracted from datashapes.org. App cardinality from tbox-cardinality.ttl." ;`,
    `.`,
    "",
  ].join("\n");

  const finalTurtle = header + turtle_output + "\n" + cardinalityTurtle;

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, finalTurtle, "utf-8");
  console.log(`[tbox] wrote ${OUTPUT_PATH} (${(finalTurtle.length / 1024).toFixed(1)} KB)`);
}

// Extract the property name from a datashapes.org property shape URI
// e.g. "http://schema.org/Thing-name" → "name", 
// "http://schema.org/CreativeWork-publisher" → "publisher"
function extractPropertyName(uri) {
  const localPart = uri.split(/[#/]/).pop() ?? "";
  const dashIndex= localPart.lastIndexOf("-");
  return dashIndex >= 0 ? localPart.substring(dashIndex + 1) : localPart;
}

function collectAncestors(typeUris, store) {
  const RDFS_SUBCLASS = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
  const visited = new Set(typeUris);
  const queue = [...typeUris];

  while (queue.length > 0) {
    const current = queue.shift();
    const parents = store.getObjects(current, RDFS_SUBCLASS, null);
    for (const parent of parents) {
      if (!visited.has(parent.value)) {
        visited.add(parent.value);
        queue.push(parent.value);
      }
    }
  }

  return [...visited].filter((uri) => !typeUris.includes(uri));
}

main().catch((err) => {
  console.error("[tbox] FATAL:", err.message);
  process.exit(1);
});
