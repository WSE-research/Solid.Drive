/**
 * Checks a document against the soft-delete specification (docs/spec/):
 * its SHACL shapes, applied in the document's role as the section
 * "Checking a document" describes, plus the few rules that SHACL Core
 * cannot express.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DataFactory, Parser as N3Parser, Store as N3Store } from "n3";
import type { Quad, Term } from "n3";
import SHACLValidator from "rdf-validate-shacl";

const { namedNode, quad } = DataFactory;

export const SPEC_DIR = resolve(process.cwd(), "docs/spec");
export const SHAPES_NS = "https://purl.org/solid-drive/shapes#";
export const TRASH_NS = "https://purl.org/solid-drive/trash#";
export const LEGACY_TRASH_NS = "https://w3id.org/trash#";

const SH = "http://www.w3.org/ns/shacl#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SCHEMA = "http://schema.org/";
const DCTERMS = "http://purl.org/dc/terms/";
const AS_DELETED = "https://www.w3.org/ns/activitystreams#deleted";
const PROV_INVALIDATED = "http://www.w3.org/ns/prov#invalidatedAtTime";

/** The four kinds of documents the specification gives shapes for. */
export type DocumentRole = "resource-description" | "catalog" | "tombstone" | "deletion-log";

/** One problem found in a document. */
export interface Finding {
  severity: "Violation" | "Warning" | "Info";
  /** Local name of the SHACL constraint component, or `spec:<rule>` for a rule checked in code. */
  component: string;
  /** The shape that reported it, abbreviated with `sdsh:` where it is one of ours. */
  shape: string;
  focusNode: string;
  path: string;
  value: string;
  message: string;
}

/** The outcome of checking one document. */
export interface DocumentReport {
  /** No finding of severity Violation. */
  conforms: boolean;
  violations: Finding[];
  warnings: Finding[];
}

/** The role of a document, from its place in the Pod layout, or null for documents the shapes do not cover. */
export function roleOf(url: string): DocumentRole | null {
  const path = new URL(url).pathname;
  if (path.endsWith("/catalog-tombstones.ttl")) return "deletion-log";
  if (/\/trash\/[^/]+\/tombstone\.ttl$/.test(path)) return "tombstone";
  if (path.endsWith("/catalog.ttl") || path.endsWith("/catalog-snapshot.ttl")) return "catalog";
  if (path.endsWith("/index.ttl")) return "resource-description";
  return null;
}

let shapesQuads: Quad[] | null = null;

/** The shapes graph, parsed once. */
export function shapes(): Quad[] {
  shapesQuads ??= new N3Parser().parse(readFileSync(resolve(SPEC_DIR, "shapes.ttl"), "utf8"));
  return shapesQuads;
}

const short = (term: Term | null | undefined): string => {
  if (!term) return "";
  if (term.termType === "BlankNode") return "_:b";
  return term.value.startsWith(SHAPES_NS) ? `sdsh:${term.value.slice(SHAPES_NS.length)}` : term.value;
};

/**
 * The subjects a role's main shape is applied to, so that a document
 * without its main statements cannot pass. A deletion log needs none: its
 * entries are exactly the subjects with `as:deleted`, which the shapes
 * target themselves, and an empty log is a valid one.
 */
function focusTargets(role: DocumentRole, url: string, data: N3Store): Quad[] {
  const target = (shape: string, node: string) => quad(namedNode(`${SHAPES_NS}${shape}`), namedNode(`${SH}targetNode`), namedNode(node));
  switch (role) {
    case "catalog":
      return [target("CatalogShape", url)];
    case "tombstone":
      return ["TombstoneShape", "TombstoneNamespaceShape", "TombstonePartsShape"].map((shape) => target(shape, url));
    case "resource-description": {
      // A copy in the trash keeps the subject of the original document.
      const subjects = new Set(data.getSubjects(null, null, null).map((subject) => subject.value));
      const subject = new URL(url).pathname.includes("/trash/") && subjects.size === 1 ? [...subjects][0] : url;
      return [target("ResourceDescriptionShape", subject)];
    }
    case "deletion-log":
      return [];
  }
}

function codeFinding(component: string, focusNode: string, path: string, value: string, message: string): Finding {
  return { severity: "Violation", component: `spec:${component}`, shape: "(checked in code)", focusNode, path, value, message };
}

/** Rules of the specification that SHACL Core cannot express, because they compare IRIs with each other. */
function codeChecks(role: DocumentRole, data: N3Store): Finding[] {
  const findings: Finding[] = [];
  const containerOf = (iri: string) => iri.slice(0, iri.lastIndexOf("/", iri.endsWith("/") ? iri.length - 2 : iri.length) + 1);
  if (role === "resource-description") {
    for (const q of data.getQuads(null, `${SCHEMA}contentUrl`, null, null)) {
      const binary = q.object.value;
      if (containerOf(binary) !== containerOf(q.subject.value) || binary.endsWith("/")) {
        findings.push(codeFinding("contentUrlInContainer", q.subject.value, `${SCHEMA}contentUrl`, binary,
          "schema:contentUrl names a direct child of the container that holds the index.ttl."));
      }
    }
  }
  if (role === "tombstone") {
    for (const tombstone of data.getSubjects(RDF_TYPE, "https://www.w3.org/ns/activitystreams#Tombstone", null)) {
      const entry = containerOf(tombstone.value);
      for (const part of data.getObjects(tombstone, `${DCTERMS}hasPart`, null)) {
        if (!part.value.startsWith(entry) || part.value === entry) {
          findings.push(codeFinding("partInEntry", tombstone.value, `${DCTERMS}hasPart`, part.value,
            "Every dcterms:hasPart of a tombstone lies in the tombstone's own trash entry."));
        }
      }
      const deleted = data.getObjects(tombstone, AS_DELETED, null).map((time) => Date.parse(time.value));
      const invalidated = data.getObjects(tombstone, PROV_INVALIDATED, null).map((time) => Date.parse(time.value));
      if (deleted.length === 1 && invalidated.length === 1 && deleted[0] !== invalidated[0]) {
        findings.push(codeFinding("deletionTimesEqual", tombstone.value, PROV_INVALIDATED, String(invalidated[0]),
          "prov:invalidatedAtTime is the same instant as as:deleted."));
      }
      const kind = data.getObjects(tombstone, `${TRASH_NS}kind`, null)[0] ?? data.getObjects(tombstone, `${LEGACY_TRASH_NS}kind`, null)[0];
      const source = data.getObjects(tombstone, `${DCTERMS}source`, null)[0];
      const instance = data.getObjects(tombstone, `${TRASH_NS}originalInstance`, null)[0] ?? data.getObjects(tombstone, `${LEGACY_TRASH_NS}originalInstance`, null)[0];
      if (kind?.value === "file" && source && instance && instance.value !== `${source.value}index.ttl`) {
        findings.push(codeFinding("fileInstanceIsIndex", tombstone.value, `${TRASH_NS}originalInstance`, instance.value,
          "The trash:originalInstance of a file is the index.ttl in its dcterms:source container."));
      }
    }
  }
  if (role === "deletion-log") {
    for (const q of data.getQuads(null, null, null, null)) {
      if (q.predicate.value !== AS_DELETED) {
        findings.push({ ...codeFinding("logHoldsDeletionsOnly", q.subject.value, q.predicate.value, q.object.value,
          "A deletion log holds only as:deleted statements; readers ignore anything else."), severity: "Warning" });
      }
    }
  }
  return findings;
}

/**
 * Checks one Turtle document in its role. A document that is not Turtle
 * gets a single violation.
 *
 * @param url - The document's URL, also the base IRI for parsing it.
 */
export async function checkDocument(url: string, turtle: string, role: DocumentRole): Promise<DocumentReport> {
  let quads: Quad[];
  try {
    quads = new N3Parser({ baseIRI: url }).parse(turtle);
  } catch (error) {
    const finding = codeFinding("turtle", url, "", "", `The document is not valid Turtle: ${(error as Error).message}`);
    return { conforms: false, violations: [finding], warnings: [] };
  }
  const data = new N3Store(quads);
  const shapesGraph = new N3Store([...shapes(), ...focusTargets(role, url, data)]);
  const report = await new SHACLValidator(shapesGraph).validate(data);
  const findings: Finding[] = report.results.map((result) => ({
    severity: (result.severity?.value.slice(SH.length) ?? "Violation") as Finding["severity"],
    component: result.sourceConstraintComponent?.value.slice(SH.length) ?? "",
    shape: short(result.sourceShape),
    focusNode: result.focusNode?.value ?? "",
    path: short(result.path),
    value: result.value?.value ?? "",
    message: result.message.map((message) => message.value).join(" "),
  }));
  findings.push(...codeChecks(role, data));
  const violations = findings.filter((finding) => finding.severity === "Violation");
  return { conforms: violations.length === 0, violations, warnings: findings.filter((finding) => finding.severity !== "Violation") };
}
