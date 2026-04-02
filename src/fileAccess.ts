import { Writer, Parser, DataFactory } from "n3";
import type { Quad } from "n3";

const { namedNode, quad } = DataFactory;

const ACL_NS = "http://www.w3.org/ns/auth/acl#";
const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

const ACL = {
  Authorization: namedNode(`${ACL_NS}Authorization`),
  agent: namedNode(`${ACL_NS}agent`),
  accessTo: namedNode(`${ACL_NS}accessTo`),
  default: namedNode(`${ACL_NS}default`),
  mode: namedNode(`${ACL_NS}mode`),
  Read: namedNode(`${ACL_NS}Read`),
  Write: namedNode(`${ACL_NS}Write`),
  Control: namedNode(`${ACL_NS}Control`),
};

export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

// Serialize an array of N3 quads into a Turtle string.
function serializeTurtle(quads: Quad[]): string {
  let turtle = "";
  const writer = new Writer({ prefixes: { acl: ACL_NS } });
  writer.addQuads(quads);
  writer.end((_err, result) => {
    turtle = result;
  });
  return turtle;
}

// Build ACL quads granting the owner full Read, Write, and Control access
// When includeDefault is true, the permissions also apply to children of the container
function ownerQuads(authId: string, resourceUri: string, ownerWebId: string, includeDefault: boolean): Quad[] {
  const auth = namedNode(authId);
  const resource = namedNode(resourceUri);
  const owner = namedNode(ownerWebId);
  return [
    quad(auth, RDF_TYPE, ACL.Authorization),
    quad(auth, ACL.agent, owner),
    quad(auth, ACL.accessTo, resource),
    ...(includeDefault ? [quad(auth, ACL.default, resource)] : []),
    quad(auth, ACL.mode, ACL.Read),
    quad(auth, ACL.mode, ACL.Write),
    quad(auth, ACL.mode, ACL.Control),
  ];
}

// Build ACL quads granting a single agent Read-only access.
// When includeDefault is true, read access also applies to children of the container.
function agentReadQuads(authId: string, resourceUri: string, agentWebId: string, includeDefault: boolean): Quad[] {
  const auth = namedNode(authId);
  const resource = namedNode(resourceUri);
  const agent = namedNode(agentWebId);
  return [
    quad(auth, RDF_TYPE, ACL.Authorization),
    quad(auth, ACL.agent, agent),
    quad(auth, ACL.accessTo, resource),
    ...(includeDefault ? [quad(auth, ACL.default, resource)] : []),
    quad(auth, ACL.mode, ACL.Read),
  ];
}

/**
 * Find the ACL resource URI for a container by reading its Link header.
 * Solid servers advertise the ACL via rel="acl".
 */
export async function discoverAclUri(containerUri: string, fetch: FetchFn): Promise<string> {
  let containerUrl: URL;
  try {
    containerUrl = new URL(containerUri);
  } catch {
    throw new Error(`ACL discovery requires an absolute container URI, received "${containerUri}"`);
  }

  const response = await fetch(containerUri, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`HEAD ${containerUri} returned ${response.status} ${response.statusText}`);
  }
  const linkHeader = response.headers.get("Link") ?? "";
  const aclLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="acl"/);
  if (!aclLinkMatch) {
    throw new Error(`No ACL link header found for ${containerUri}`);
  }
  const aclUri = aclLinkMatch[1];
  if (aclUri.startsWith("http://") || aclUri.startsWith("https://")) return aclUri;
  return new URL(aclUri, containerUrl).href;
}

/**
 * Read WebIDs of agents with read-only access from an ACL document.
 * Only agents with acl:Read but not acl:Write — i.e. people the file
 * was shared with, not the owner or co-editors.
 */
export async function readAclAgents(aclUri: string, fetch: FetchFn): Promise<string[]> {
  const response = await fetch(aclUri);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`GET ${aclUri} returned ${response.status} ${response.statusText}`);
  }
  const turtle = await response.text();

  const parser = new Parser({ baseIRI: aclUri });
  const quads = parser.parse(turtle);

  const authSubjects = new Set(
    quads
      .filter((quad) => quad.predicate.equals(RDF_TYPE) && quad.object.equals(ACL.Authorization))
      .map((quad) => quad.subject.value)
  );

  const agents: string[] = [];
  for (const subject of authSubjects) {
    const modes = quads.filter((quad) => quad.subject.value === subject && quad.predicate.equals(ACL.mode)).map((quad) => quad.object.value);

    const hasRead = modes.includes(`${ACL_NS}Read`);
    const hasWrite = modes.includes(`${ACL_NS}Write`);

    if (!hasRead || hasWrite) continue;

    quads
      .filter((quad) => quad.subject.value === subject && quad.predicate.equals(ACL.agent))
      .forEach((quad) => agents.push(quad.object.value));
  }

  return agents;
}

/**
 * Build ACL Turtle for a container where grantees can list the container
 * but don't inherit read access to children.
 */
export function buildListOnlyAclTurtle(containerUri: string, ownerWebId: string, agentWebIds: string[]): string {
  return serializeTurtle([
    ...ownerQuads("#owner", containerUri, ownerWebId, true),
    ...agentWebIds.flatMap((webId, index) => agentReadQuads(`#list-${index}`, containerUri, webId, false)),
  ]);
}

// Write a list-only ACL to the pod, replacing any existing ACL
export async function writeListOnlyAcl(
  aclUri: string,
  containerUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  const turtle = buildListOnlyAclTurtle(containerUri, ownerWebId, agentWebIds);
  const response = await fetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status} ${response.statusText}`);
  }
}

/**
 * Build ACL Turtle for a single resource — grantees can read just that
 * document, no container defaults.
 */
export function buildResourceAclTurtle(resourceUri: string, ownerWebId: string, agentWebIds: string[]): string {
  return serializeTurtle([
    ...ownerQuads("#owner", resourceUri, ownerWebId, false),
    ...agentWebIds.flatMap((webId, index) => agentReadQuads(`#read-${index}`, resourceUri, webId, false)),
  ]);
}

/**
 * Build ACL Turtle granting read access to a container and its children
 * via acl:default. Used for file containers so shared users can read
 * everything inside.
 */
export function buildAclTurtle(containerUri: string, ownerWebId: string, agentWebIds: string[]): string {
  return serializeTurtle([
    ...ownerQuads("#owner", containerUri, ownerWebId, true),
    ...agentWebIds.flatMap((webId, index) => agentReadQuads(`#read-${index}`, containerUri, webId, true)),
  ]);
}

/** Write a container ACL granting read access to the container and all its children. */
export async function writeAcl(
  aclUri: string,
  containerUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  const turtle = buildAclTurtle(containerUri, ownerWebId, agentWebIds);
  const response = await fetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status} ${response.statusText}`);
  }
}

/** Write an ACL for a single resource — no acl:default, children aren't affected. */
export async function writeResourceAcl(
  aclUri: string,
  resourceUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  const turtle = buildResourceAclTurtle(resourceUri, ownerWebId, agentWebIds);
  const response = await fetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status} ${response.statusText}`);
  }
}
