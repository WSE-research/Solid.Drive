/**
 * @packageDocumentation
 * Evaluates whether WAC/ACL rights are preserved during soft deletion and restoration.
 *
 * For each ACL configuration, the test writes a known ACL to the resource
 * container, performs a soft deletion then restoration, 
 * and compares the restored ACL with the original RDF graph.
 *
 * The comparison is independent of Turtle statement order and verifies that
 * the ACL is preserved without loss of triples.
 */

import { Parser, termToId, type Quad } from "n3";
import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { restoreTrashedFile } from "@/features/file-explorer/services/restoreTrashedFile";
import { discoverAclUri, readAclDocument, writeAclDocument } from "@/infrastructure/wac/aclManager";
import { provisionSession, type PodSession } from "../../lib/podSession";
import { toFetchFn } from "../../lib/auth";
import { sharedEntry } from "../soft-delete/fileFixture";
import { prepareFile } from "../soft-delete/prepareFile";
import { writeResults } from "../soft-delete/runnerShared";

// Reads and normalizes the required server base URL.
function parseBaseUrl(argv: string[]): string {
  const flagIndex = argv.indexOf("--base-url");
  const value = flagIndex >= 0 ? argv[flagIndex + 1] : "";
  if (!value) throw new Error("--base-url is required");
  return value.endsWith("/") ? value : `${value}/`;
}

const BASE_URL = parseBaseUrl(process.argv.slice(2));

const ACL_PREFIXES = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .`;

// Creates an acl:Authorization with the given subject, access modes,
// and optional additional predicates.
function authorizationBlock(id: string, containerUri: string, agentTriple: string, modes: string[], extra: string[] = []): string {
  const predicates = ["a acl:Authorization", agentTriple, `acl:accessTo <${containerUri}>`, `acl:default <${containerUri}>`, `acl:mode ${modes.join(", ")}`, ...extra];
  return `<#${id}> ${predicates.join(" ;\n  ")} .`;
}

const ownerBlock = (containerUri: string, webId: string) =>
  authorizationBlock("owner", containerUri, `acl:agent <${webId}>`, ["acl:Read", "acl:Write", "acl:Control"]);

// Grants the owner Read, Write, and Control access.
function ownerOnlyAcl(containerUri: string, webId: string): string {
  return `${ACL_PREFIXES}\n${ownerBlock(containerUri, webId)}\n`;
}

// Adds public Read access through foaf:Agent.
function publicReadAcl(containerUri: string, webId: string): string {
  const publicBlock = authorizationBlock("public", containerUri, "acl:agentClass foaf:Agent", ["acl:Read"]);
  return `${ACL_PREFIXES}\n${ownerBlock(containerUri, webId)}\n${publicBlock}\n`;
}

// Grants the owner full control, plus an acl:agentGroup grant for Read/Write.
function groupAcl(containerUri: string, webId: string): string {
  const groupUri = `${containerUri}group-members.ttl#group`;
  const groupBlock = authorizationBlock("group", containerUri, `acl:agentGroup <${groupUri}>`, ["acl:Read", "acl:Write"]);
  return `${ACL_PREFIXES}\n${ownerBlock(containerUri, webId)}\n${groupBlock}\n`;
}

// Restricts the owner's authorization to a specific request origin.
function originRestrictedAcl(containerUri: string, webId: string): string {
  const modes = ["acl:Read", "acl:Write", "acl:Control"];
  const block = authorizationBlock("owner", containerUri, `acl:agent <${webId}>`, modes, ["acl:origin <https://thesis-origin.example/>"]);
  return `${ACL_PREFIXES}\n${block}\n`;
}

// Combines owner, public, and group-based authorizations in one ACL document.
function mixedAuthorizationsAcl(containerUri: string, webId: string): string {
  const groupUri = `${containerUri}group-members.ttl#group`;
  const publicBlock = authorizationBlock("public", containerUri, "acl:agentClass foaf:Agent", ["acl:Read"]);
  const contributorsBlock = authorizationBlock("contributors", containerUri, `acl:agentGroup <${groupUri}>`, ["acl:Append"]);
  return `${ACL_PREFIXES}\n${ownerBlock(containerUri, webId)}\n${publicBlock}\n${contributorsBlock}\n`;
}

// Converts an RDF quad into a comparable representation.
// Literal datatypes and language tags are preserved. Blank nodes are not used in the evaluated ACL cases.
function quadToKey(quad: Quad): string {
  return `${termToId(quad.subject)} ${termToId(quad.predicate)} ${termToId(quad.object)}`;
}

// Parses Turtle into a sorted list of triple strings, so two documents can be compared regardless of statement order.
function quadKeys(turtle: string, baseIRI: string): string[] {
  return new Parser({ baseIRI }).parse(turtle).map(quadToKey).sort();
}

// Checks whether two ACL documents contain the same RDF triples.
function sameAcl(left: string, right: string, baseIRI: string): boolean {
  const leftKeys = quadKeys(left, baseIRI);
  const rightKeys = quadKeys(right, baseIRI);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

interface AclCase {
  name: string;
  createAcl: (containerUri: string, webId: string) => string;
}

// Sets an ACL for the given case,
// soft-deletes and restores the file, then checks the ACL came back unchanged.
async function runCase(session: PodSession, aclCase: AclCase): Promise<Check> {
  const { name, createAcl } = aclCase;
  const { authFetch: base, pod, webId } = session;
  const appFetch = toFetchFn(base);

  const file = await prepareFile(base, pod, webId, 2, 0, `acl-${name}`);
  const container = file.descriptor.layout.containerUri;
  const shared = { storageRootUri: file.storageRoot, entry: sharedEntry(file.descriptor), ownerWebId: webId, fetch: appFetch };

  const aclUri = await discoverAclUri(container, appFetch);
  await writeAclDocument(aclUri, createAcl(container, webId), appFetch);
  const originalAcl = await readAclDocument(aclUri, appFetch);
  if (originalAcl === null) return { name, ok: false, detail: "could not set/read original ACL" };

  const del = await softDeleteFile({ ...shared, containerUri: container, catalogUri: file.mainCatalogUri });
  if (!del.ok) return { name, ok: false, detail: `soft-delete failed: ${del.reason}` };

  const restored = await restoreTrashedFile({ ...shared, trashItemContainerUri: del.trashItemContainerUri });
  if (!restored.ok) return { name, ok: false, detail: `restore failed: ${restored.reason}` };
  if (!restored.aclRestored) return { name, ok: false, detail: "restore reported aclRestored=false" };

  const restoredAclUri = await discoverAclUri(container, appFetch);
  if (restoredAclUri !== aclUri) return { name, ok: false, detail: `ACL URI changed from ${aclUri} to ${restoredAclUri}` };
  const restoredAcl = await readAclDocument(restoredAclUri, appFetch);
  if (restoredAcl === null) return { name, ok: false, detail: "restored ACL missing" };

  const identical = sameAcl(originalAcl, restoredAcl, aclUri);
  return { name, ok: identical, detail: identical ? "restored ACL triple-identical" : "restored ACL differs from original" };
}

const ACL_CASES: AclCase[] = [
  { name: "owner-only", createAcl: ownerOnlyAcl },
  { name: "public-read", createAcl: publicReadAcl },
  { name: "group-access", createAcl: groupAcl },
  { name: "origin-restricted", createAcl: originRestrictedAcl },
  { name: "mixed-authorizations", createAcl: mixedAuthorizationsAcl },
];

// Runs one case, turning a thrown error into a failed check instead of aborting the run.
async function runCaseSafely(session: PodSession, aclCase: AclCase): Promise<Check> {
  try {
    return await runCase(session, aclCase);
  } catch (error) {
    return { name: aclCase.name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

// Runs every ACL case against a fresh pod, writes the results, and exits non-zero on any failure.
async function main(): Promise<void> {
  const runId = `ac${Date.now().toString(36)}`;
  console.log(`base URL     ${BASE_URL}`);
  const session = await provisionSession(BASE_URL, runId);
  console.log(`server       ${session.serverHeader}`);
  console.log(`pod          ${session.pod}\n`);

  const checks: Check[] = [];
  for (const aclCase of ACL_CASES) {
    const check = await runCaseSafely(session, aclCase);
    console.log(`${check.ok ? "PASS" : "FAIL"}  ACL ${check.name} — ${check.detail}`);
    checks.push(check);
  }

  const rows = checks.map((check) => ({ check: check.name, passed: check.ok ? 1 : 0, detail: check.detail }));
  const outPath = writeResults("acl-preservation", runId, { args: { baseUrl: BASE_URL, repeats: 1 }, server: session.serverHeader, pod: session.pod, rows });
  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} preserved. wrote ${outPath}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
