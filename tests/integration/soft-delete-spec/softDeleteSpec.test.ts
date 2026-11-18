/**
 * Checks the soft-delete and catalog specification in docs/spec/ against
 * real documents:
 *
 * - the golden fixtures that Solid.Sync pins (written by Solid.Drive v2.1.0),
 * - the documents Solid.Drive's own code writes at this commit, generated
 *   on an in-memory Pod with and without N3 Patch (generateDocuments.ts),
 * - the hand-written examples, which must conform (valid/) or fail with the
 *   findings their header names (invalid/),
 *
 * and keeps the vocabulary, the shapes, and the specification text at the
 * same version. Violations in Solid.Drive's own output must be known gaps
 * of the specification (section 11); a fixed gap fails this test until it
 * is removed from KNOWN_GAPS and from the specification.
 *
 * `SPEC_REPORT=1` prints the counts the specification reports in section 10.
 * `SPEC_EXAMPLES_UPDATE=1` rewrites docs/spec/examples/generated/.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Parser as N3Parser, Store as N3Store, Writer as N3Writer } from "n3";
import type { Quad } from "n3";
import { RDF_NAMESPACES } from "@/config";
import { checkDocument, LEGACY_TRASH_NS, roleOf, SPEC_DIR, TRASH_NS, type DocumentReport, type DocumentRole } from "./specValidation";
import { CATALOG, generateDocuments, REPORT_NAME, ROOT, TRASH_CATALOG, TRASH_IDS, type GeneratedDocument } from "./generateDocuments";

vi.mock("@ldo/solid-react", async () => (await import("./ldoBinding")).solidReactStub);

const EXAMPLES = resolve(SPEC_DIR, "examples");
const OWL = "http://www.w3.org/2002/07/owl#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";

/** Violations Solid.Drive's own output shows at this commit, with their entry in section 11 of the specification. */
const KNOWN_GAPS: Record<string, string> = {
  "sdsh:ResourceDescription-type MinCountConstraintComponent": "KG4: index.ttl without rdf:type",
  "sdsh:ResourceDescription-typeKnown QualifiedMinCountConstraintComponent": "KG4: index.ttl without rdf:type",
  "sdsh:ResourceDescription-encodingFormat MinCountConstraintComponent": "KG5: no media type for an unrecognized file",
  "sdsh:Distribution-mediaType PatternConstraintComponent": "KG5: no media type for an unrecognized file",
};

const keyOf = (finding: { shape: string; component: string }) =>
  finding.component.startsWith("spec:") ? finding.component : `${finding.shape} ${finding.component}`;

/** An example file with its `# role:`, `# document:`, and `# expect:` header lines. */
interface Example {
  name: string;
  role: DocumentRole;
  url: string;
  expect: string[];
  body: string;
}

function readExample(directory: string, name: string): Example {
  const body = readFileSync(resolve(EXAMPLES, directory, name), "utf8");
  const header = (key: string) => [...body.matchAll(new RegExp(`^# ${key}: (.+)$`, "gm"))].map((match) => match[1].trim());
  const [role] = header("role");
  const [url] = header("document");
  if (!role || !url) throw new Error(`${directory}/${name} lacks a "# role:" or "# document:" line`);
  return { name, role: role as DocumentRole, url, expect: header("expect"), body };
}

const examplesIn = (directory: string) =>
  readdirSync(resolve(EXAMPLES, directory)).filter((name) => name.endsWith(".ttl")).sort().map((name) => readExample(directory, name));

/** Serializes quads as Turtle, declaring the prefixes it uses. */
function toTurtle(quads: Quad[], prefixes: Record<string, string>): string {
  const iris = quads.flatMap((q) => [q.subject, q.predicate, q.object, ...(q.object.termType === "Literal" ? [q.object.datatype] : [])])
    .filter((term) => term.termType === "NamedNode").map((term) => term.value);
  const used = Object.fromEntries(Object.entries(prefixes).filter(([, namespace]) => iris.some((iri) => iri.startsWith(namespace))));
  let turtle = "";
  const writer = new N3Writer({ prefixes: used });
  writer.addQuads(quads);
  writer.end((error, result) => {
    if (error) throw error;
    turtle = result;
  });
  return turtle;
}

const sortedTriples = (quads: Quad[]) => new N3Writer({ format: "N-Triples" }).quadsToString(quads).split("\n").filter(Boolean).sort();

/** The Solid.Sync golden fixtures (Solid.Drive v2.1.0), with the URL each document has on the fixture's Pod. */
function goldenDocuments(): { source: string; url: string; body: string }[] {
  const directory = resolve(EXAMPLES, "solid-sync-v2.1.0");
  const file = (name: string) => readFileSync(resolve(directory, name), "utf8");
  const documents = [
    { source: "solid_drive_v2.1.0_catalog_row.ttl", url: "https://pod.example/alice/catalog.ttl", body: file("solid_drive_v2.1.0_catalog_row.ttl") },
    { source: "solid_drive_v2.1.0_deletion_log.ttl", url: "https://pod.example/alice/catalog-tombstones.ttl", body: file("solid_drive_v2.1.0_deletion_log.ttl") },
    {
      source: "solid_drive_v2.1.0_tombstone.ttl",
      url: "https://pod.example/alice/trash/cccccccc-cccc-4ccc-8ccc-cccccccccccc/tombstone.ttl",
      body: file("solid_drive_v2.1.0_tombstone.ttl"),
    },
  ];
  const pod = JSON.parse(file("solid_drive_v2.1.0_soft_delete.json")) as { resources: Record<string, { base64: string; contentType: string }> };
  for (const [url, resource] of Object.entries(pod.resources)) {
    if (resource.contentType !== "text/turtle") continue;
    documents.push({ source: "solid_drive_v2.1.0_soft_delete.json", url, body: Buffer.from(resource.base64, "base64").toString("utf8") });
  }
  return documents;
}

/** Prints what section 10 of the specification reports, when SPEC_REPORT is set. */
function report(title: string, rows: { url: string; role: DocumentRole; result: DocumentReport; step?: string }[]): void {
  if (!process.env.SPEC_REPORT) return;
  const byRole = new Map<string, { total: number; conforming: number }>();
  const causes = new Map<string, number>();
  const warnings = new Map<string, number>();
  for (const { role, result } of rows) {
    const entry = byRole.get(role) ?? { total: 0, conforming: 0 };
    entry.total += 1;
    entry.conforming += result.conforms ? 1 : 0;
    byRole.set(role, entry);
    for (const key of new Set(result.violations.map(keyOf))) causes.set(key, (causes.get(key) ?? 0) + 1);
    for (const key of new Set(result.warnings.map(keyOf))) warnings.set(key, (warnings.get(key) ?? 0) + 1);
  }
  const conforming = rows.filter((row) => row.result.conforms).length;
  console.info(
    [
      `== ${title}: ${conforming} of ${rows.length} documents conform`,
      ...[...byRole].map(([role, { total, conforming: ok }]) => `   ${role}: ${ok} of ${total}`),
      ...[...causes].map(([key, count]) => `   violation in ${count} documents: ${key}`),
      ...[...warnings].map(([key, count]) => `   warning in ${count} documents: ${key}`),
      ...rows.map(({ url, role, result, step }) =>
        `   ${result.conforms ? "conforms" : "fails   "} ${role.padEnd(20)} ${step ? `[${step}] ` : ""}${url}${result.conforms ? "" : ` (${[...new Set(result.violations.map(keyOf))].join(", ")})`}`),
    ].join("\n"),
  );
}

describe("soft-delete specification (docs/spec/)", () => {
  describe("vocabulary, shapes, and text share one version", () => {
    const vocabulary = new N3Store(new N3Parser().parse(readFileSync(resolve(SPEC_DIR, "trash.ttl"), "utf8")));
    const shapesText = readFileSync(resolve(SPEC_DIR, "shapes.ttl"), "utf8");
    const shapesGraph = new N3Store(new N3Parser().parse(shapesText));
    const specText = readFileSync(resolve(SPEC_DIR, "soft-delete.md"), "utf8");
    const specVersion = /^\*\*Version:\*\* (\S+)/m.exec(specText)?.[1];
    const terms = ["kind", "originalParent", "originalCatalog", "originalInstance"];

    it("states the same version in the specification, the vocabulary, and the shapes", () => {
      expect(specVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(vocabulary.getObjects("https://purl.org/solid-drive/trash", `${OWL}versionInfo`, null).map((term) => term.value)).toEqual([specVersion]);
      expect(vocabulary.getObjects("https://purl.org/solid-drive/trash", `${OWL}versionIRI`, null).map((term) => term.value)).toEqual([
        `https://purl.org/solid-drive/trash/${specVersion}`,
      ]);
      expect(shapesGraph.getObjects("https://purl.org/solid-drive/shapes", `${OWL}versionInfo`, null).map((term) => term.value)).toEqual([specVersion]);
      expect(specText).toContain(`### ${specVersion}`);
    });

    it("defines each trash term with an English label and comment, and links its legacy IRI", () => {
      for (const term of terms) {
        const iri = `${TRASH_NS}${term}`;
        const english = (predicate: string) =>
          vocabulary.getObjects(iri, predicate, null).filter((value) => value.termType === "Literal" && value.language === "en");
        expect(english(`${RDFS}label`), term).toHaveLength(1);
        expect(english(`${RDFS}comment`), term).toHaveLength(1);
        expect(vocabulary.getObjects(iri, `${RDFS}isDefinedBy`, null).map((value) => value.value)).toEqual(["https://purl.org/solid-drive/trash"]);
        expect(vocabulary.getObjects(iri, `${OWL}equivalentProperty`, null).map((value) => value.value)).toEqual([`${LEGACY_TRASH_NS}${term}`]);
      }
    });

    it("uses no trash term in the shapes that the vocabulary does not define", () => {
      const used = new Set(
        shapesGraph
          .getQuads(null, null, null, null)
          .flatMap((q) => [q.subject, q.predicate, q.object])
          .filter((term) => term.termType === "NamedNode" && term.value.startsWith(TRASH_NS))
          .map((term) => term.value.slice(TRASH_NS.length)),
      );
      expect([...used].sort()).toEqual([...terms].sort());
    });

    it("lets Solid.Drive write only a namespace that the specification accepts (section 9)", () => {
      expect([TRASH_NS, LEGACY_TRASH_NS]).toContain(RDF_NAMESPACES.TRASH);
    });
  });

  describe("Solid.Sync golden fixtures, written by Solid.Drive v2.1.0", () => {
    const documents = goldenDocuments();
    const results: { url: string; role: DocumentRole; result: DocumentReport }[] = [];

    beforeAll(async () => {
      for (const document of documents) {
        const role = roleOf(document.url);
        if (!role) throw new Error(`No role for ${document.url}`);
        results.push({ url: document.url, role, result: await checkDocument(document.url, document.body, role) });
      }
      report("Solid.Sync golden fixtures (Solid.Drive v2.1.0)", results);
    });

    it("covers all eight Turtle documents of the fixtures", () => {
      expect(results.map(({ role }) => role).sort()).toEqual([
        "catalog", "catalog", "catalog", "deletion-log", "deletion-log", "resource-description", "tombstone", "tombstone",
      ]);
    });

    it("finds every document conforming except the stub index.ttl that the fixture's harness seeded", () => {
      for (const { url, result } of results) {
        if (url.endsWith("/index.ttl")) continue;
        expect(result.violations, url).toEqual([]);
      }
      const stub = results.find(({ url }) => url.endsWith("/index.ttl"));
      // The fixture's original index.ttl held only an rdf:type; softDeleteFile copied it unchanged.
      expect(stub?.result.violations.map(keyOf).sort()).toEqual([
        "sdsh:ResourceDescription-contentSize MinCountConstraintComponent",
        "sdsh:ResourceDescription-encodingFormat MinCountConstraintComponent",
        "sdsh:ResourceDescription-uploadDate MinCountConstraintComponent",
      ]);
    });
  });

  describe.each([
    { server: "with N3 Patch (like the Community Solid Server)", n3Patch: true },
    { server: "without N3 Patch (like the PHP Solid Server)", n3Patch: false },
  ])("documents Solid.Drive writes on a Pod $server", ({ server, n3Patch }) => {
    let documents: GeneratedDocument[] = [];
    const results: { document: GeneratedDocument; role: DocumentRole; result: DocumentReport }[] = [];

    beforeAll(async () => {
      documents = (await generateDocuments(n3Patch)).documents;
      for (const document of documents) {
        const role = roleOf(document.url);
        if (role) results.push({ document, role, result: await checkDocument(document.url, document.body, role) });
      }
      report(`Solid.Drive at this commit, Pod ${server}`, results.map(({ document, role, result }) => ({ url: document.url, role, result, step: document.step })));
    }, 60_000);

    it("writes every kind of document the specification describes", () => {
      expect(new Set(results.map(({ role }) => role))).toEqual(new Set(["catalog", "resource-description", "tombstone", "deletion-log"]));
      const paths = new Set(results.map(({ document }) => document.url.replace(ROOT, "")));
      for (const path of [
        "catalog.ttl", "catalog-tombstones.ttl", "trash/catalog.ttl", "trash/catalog-tombstones.ttl",
        `trash/${TRASH_IDS.notes}/tombstone.ttl`, `trash/${TRASH_IDS.projects}/tombstone.ttl`, `trash/${TRASH_IDS.projects}/catalog-snapshot.ttl`,
      ]) {
        expect(paths, path).toContain(path);
      }
    });

    it("shows only violations that section 11 lists as known gaps", () => {
      const unknown = results.flatMap(({ document, result }) =>
        result.violations.filter((finding) => !(keyOf(finding) in KNOWN_GAPS)).map((finding) => ({ url: document.url, step: document.step, ...finding })),
      );
      expect(unknown).toEqual([]);
    });

    it("still shows every known gap, so a fixed one is removed from KNOWN_GAPS and the specification", () => {
      const seen = new Set(results.flatMap(({ result }) => result.violations.map(keyOf)));
      expect([...seen].sort()).toEqual(Object.keys(KNOWN_GAPS).sort());
    });

    it("writes tombstones, deletion logs, and the trash catalog that conform", () => {
      for (const { document, role, result } of results) {
        if (role === "tombstone" || role === "deletion-log" || document.url === TRASH_CATALOG) {
          expect(result.violations, `${document.step}: ${document.url}`).toEqual([]);
        }
      }
    });
  });

  describe("examples", () => {
    it("writes the same graphs on Pods with and without N3 Patch", async () => {
      const graphs = async (n3Patch: boolean) =>
        new Map((await generateDocuments(n3Patch)).documents.map((document) => [
          `${document.step} ${document.url}`,
          sortedTriples(new N3Parser({ baseIRI: document.url }).parse(document.body)).join("\n"),
        ]));
      const [withPatch, withoutPatch] = [await graphs(true), await graphs(false)];
      expect([...withoutPatch.keys()].sort()).toEqual([...withPatch.keys()].sort());
      for (const [key, graph] of withoutPatch) expect(graph, key).toEqual(withPatch.get(key));
    }, 60_000);

    const trashEntry = (id: string) => `${ROOT}trash/${id}/`;
    const generatedExamples = [
      { file: "catalog.ttl", step: "upload Projects/Drafts/draft.txt", url: CATALOG },
      { file: "index.ttl", step: `upload ${REPORT_NAME}`, url: `${ROOT}bericht-final-f-r-zo-.pdf/index.ttl` },
      { file: "trash-catalog.ttl", step: `soft-delete ${REPORT_NAME}`, url: TRASH_CATALOG },
      { file: "tombstone-file-with-acl-snapshot.ttl", step: "soft-delete notes.txt", url: `${trashEntry(TRASH_IDS.notes)}tombstone.ttl` },
      { file: "tombstone-file-unusual-name.ttl", step: `soft-delete ${REPORT_NAME}`, url: `${trashEntry(TRASH_IDS.report)}tombstone.ttl` },
      { file: "tombstone-folder.ttl", step: "soft-delete folder Projects", url: `${trashEntry(TRASH_IDS.projects)}tombstone.ttl` },
      { file: "catalog-snapshot.ttl", step: "soft-delete folder Projects", url: `${trashEntry(TRASH_IDS.projects)}catalog-snapshot.ttl` },
      { file: "catalog-tombstones.ttl", step: `soft-delete ${REPORT_NAME}`, url: `${ROOT}catalog-tombstones.ttl` },
      { file: "trash-catalog-tombstones.ttl", step: `purge ${REPORT_NAME}`, url: `${ROOT}trash/catalog-tombstones.ttl` },
    ];
    const prefixes = {
      as: "https://www.w3.org/ns/activitystreams#", dcat: "http://www.w3.org/ns/dcat#", dcterms: "http://purl.org/dc/terms/",
      prov: "http://www.w3.org/ns/prov#", schema: "http://schema.org/", sd: "https://purl.org/solid-drive/catalog#",
      w3idtrash: LEGACY_TRASH_NS, xsd: "http://www.w3.org/2001/XMLSchema#",
    };

    it("keeps docs/spec/examples/generated/ equal to what Solid.Drive writes", async () => {
      const { documents } = await generateDocuments(true);
      const directory = resolve(EXAMPLES, "generated");
      for (const { file, step, url } of generatedExamples) {
        const document = documents.filter((candidate) => candidate.url === url && candidate.step === step).at(-1);
        expect(document, `${step}: ${url}`).toBeDefined();
        const quads = new N3Parser({ baseIRI: url }).parse(document!.body);
        if (process.env.SPEC_EXAMPLES_UPDATE) {
          const turtle = toTurtle(quads, prefixes);
          const header = [
            `# Written by Solid.Drive's own code (step "${step}" of tests/integration/soft-delete-spec/generateDocuments.ts).`,
            "# Do not edit: regenerate with SPEC_EXAMPLES_UPDATE=1 npx vitest run tests/integration/soft-delete-spec",
            `# role: ${roleOf(url)}`,
            `# document: ${url}`,
          ].join("\n");
          mkdirSync(directory, { recursive: true });
          writeFileSync(resolve(directory, file), `${header}\n${turtle}`);
        }
        const committed = readExample("generated", file);
        expect(committed.url).toBe(url);
        expect(sortedTriples(new N3Parser({ baseIRI: url }).parse(committed.body)), file).toEqual(sortedTriples(quads));
      }
    }, 60_000);

    it.each(examplesIn("valid").map((example) => [example.name, example]))("valid/%s conforms with no warning", async (_name, example) => {
      const result = await checkDocument(example.url, example.body, example.role);
      expect([...result.violations, ...result.warnings]).toEqual([]);
    });

    it.each(examplesIn("invalid").map((example) => [example.name, example]))("invalid/%s fails with exactly the findings it expects", async (_name, example) => {
      expect(example.expect.length).toBeGreaterThan(0);
      const result = await checkDocument(example.url, example.body, example.role);
      expect(result.conforms).toBe(false);
      expect([...new Set(result.violations.map(keyOf))].sort()).toEqual([...example.expect].sort());
    });
  });
});
