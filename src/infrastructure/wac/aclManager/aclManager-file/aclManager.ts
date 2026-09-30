/**
 * Web Access Control (WAC) ACL management for Solid resources.
 *
 * @remarks
 * Provides discovery, reading, building, and writing of WAC-style ACL documents
 * for Solid containers and resources.
 *
 * @packageDocumentation
 */

import { Parser, DataFactory } from "n3";
import type { Quad } from "n3";
import type { FetchFn } from "@/types";
import { serializeTurtle } from "@/infrastructure/solid/rdfUtils";
import { RDF_NAMESPACES, CONTENT_TYPES } from "@/config";
import { isAbsoluteUri } from "@/shared/utils";

const { namedNode, quad } = DataFactory;

const RDF_TYPE = namedNode(`${RDF_NAMESPACES.RDF}type`);

const ACL = {
  Authorization: namedNode(`${RDF_NAMESPACES.ACL}Authorization`),
  agent: namedNode(`${RDF_NAMESPACES.ACL}agent`),
  accessTo: namedNode(`${RDF_NAMESPACES.ACL}accessTo`),
  default: namedNode(`${RDF_NAMESPACES.ACL}default`),
  mode: namedNode(`${RDF_NAMESPACES.ACL}mode`),
  Read: namedNode(`${RDF_NAMESPACES.ACL}Read`),
  Write: namedNode(`${RDF_NAMESPACES.ACL}Write`),
  Control: namedNode(`${RDF_NAMESPACES.ACL}Control`),
};

const ACL_PREFIXES = { acl: RDF_NAMESPACES.ACL };

/**
 * Builds ACL quads granting the owner full Read, Write, and Control access.
 *
 * @param authId - Fragment identifier for the authorization
 * @param resourceUri - URI of the resource being protected
 * @param ownerWebId - WebID of the owner
 * @param includeDefault - Whether permissions apply to children of a container
 * @returns Array of ACL quads
 *
 * @internal
 */
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

/**
 * Builds ACL quads granting a single agent Read-only access.
 *
 * @param authId - Fragment identifier for the authorization
 * @param resourceUri - URI of the resource being protected
 * @param agentWebId - WebID of the agent to grant access
 * @param includeDefault - Whether read access applies to children of a container
 * @returns Array of ACL quads
 *
 * @internal
 */
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
 * Discovers a resource's ACL URI via its Link header.
 *
 * @remarks
 * Solid servers advertise the ACL via `rel="acl"` in the Link header.
 * Works for containers and individual resources alike — the Link header
 * mechanism doesn't distinguish between them.
 *
 * @param resourceUri - URI of the container or resource
 * @param fetch - Authenticated fetch function
 * @returns Resolved ACL URI
 * @throws Error if no ACL link header is found
 *
 * @public
 */
export async function discoverAclUri(resourceUri: string, fetch: FetchFn): Promise<string> {
  let resourceUrl: URL;
  try {
    resourceUrl = new URL(resourceUri);
  } catch {
    throw new Error(`ACL discovery requires an absolute resource URI, received "${resourceUri}"`);
  }

  const response = await fetch(resourceUri, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`HEAD ${resourceUri} returned ${response.status} ${response.statusText}`);
  }
  const linkHeader = response.headers.get("Link") ?? "";
  const aclLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="acl"/);
  if (!aclLinkMatch) {
    throw new Error(`No ACL link header found for ${resourceUri}`);
  }
  const aclUri = aclLinkMatch[1];
  if (isAbsoluteUri(aclUri)) return aclUri;
  return new URL(aclUri, resourceUrl).href;
}

/**
 * Reads an ACL document's raw Turtle text.
 *
 * @remarks
 * Returns `null` on a 404 rather than throwing: the resource has no ACL
 * of its own and inherits from an ancestor container, which is a normal,
 * expected state for most resources.
 *
 * @param aclUri - URI of the ACL document
 * @param fetch - Authenticated fetch function
 * @returns The raw Turtle text, or `null` if no ACL document exists
 *
 * @public
 */
export async function readAclDocument(aclUri: string, fetch: FetchFn): Promise<string | null> {
  const response = await fetch(aclUri);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GET ${aclUri} returned ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * Writes raw Turtle to an ACL document, replacing any existing content.
 *
 * @param aclUri - URI of the ACL document
 * @param turtle - Turtle content to write
 * @param fetch - Authenticated fetch function
 * @throws Error if the PUT request fails
 *
 * @public
 */
export async function writeAclDocument(aclUri: string, turtle: string, fetch: FetchFn): Promise<void> {
  const response = await fetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: turtle,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status} ${response.statusText}`);
  }
}

/**
 * Reads WebIDs of agents with read-only access from an ACL document.
 *
 * @remarks
 * Returns only agents with `acl:Read` but not `acl:Write`: people the
 * file was shared with, not the owner or co-editors.
 *
 * @param aclUri - URI of the ACL document
 * @param fetch - Authenticated fetch function
 * @returns Array of agent WebIDs with read-only access
 *
 * @public
 */
export async function readAclAgents(aclUri: string, fetch: FetchFn): Promise<string[]> {
  const turtle = await readAclDocument(aclUri, fetch);
  if (turtle === null) return [];

  const parser = new Parser({ baseIRI: aclUri });
  const quads = parser.parse(turtle);

  const authSubjects = new Set(
    quads
      .filter((parsedQuad) => parsedQuad.predicate.equals(RDF_TYPE) && parsedQuad.object.equals(ACL.Authorization))
      .map((parsedQuad) => parsedQuad.subject.value)
  );

  const agents: string[] = [];
  for (const subject of authSubjects) {
    const modes = quads
      .filter((parsedQuad) => parsedQuad.subject.value === subject && parsedQuad.predicate.equals(ACL.mode))
      .map((parsedQuad) => parsedQuad.object.value);

    const hasRead = modes.includes(`${RDF_NAMESPACES.ACL}Read`);
    const hasWrite = modes.includes(`${RDF_NAMESPACES.ACL}Write`);

    if (!hasRead || hasWrite) continue;

    quads
      .filter((parsedQuad) => parsedQuad.subject.value === subject && parsedQuad.predicate.equals(ACL.agent))
      .forEach((parsedQuad) => agents.push(parsedQuad.object.value));
  }

  return agents;
}

/**
 * Builds ACL Turtle for a container where grantees can list the container
 * but don't inherit read access to children.
 *
 * @param containerUri - URI of the container
 * @param ownerWebId - WebID of the owner
 * @param agentWebIds - WebIDs of agents to grant list access
 * @returns Serialized Turtle ACL document
 *
 * @public
 */
export function buildListOnlyAclTurtle(containerUri: string, ownerWebId: string, agentWebIds: string[]): string {
  return serializeTurtle([
    ...ownerQuads("#owner", containerUri, ownerWebId, true),
    ...agentWebIds.flatMap((webId, index) => agentReadQuads(`#list-${index}`, containerUri, webId, false)),
  ], ACL_PREFIXES);
}

/**
 * Writes a list-only ACL to the pod, replacing any existing ACL.
 *
 * @param aclUri - URI of the ACL resource
 * @param containerUri - URI of the container being protected
 * @param ownerWebId - WebID of the owner
 * @param agentWebIds - WebIDs of agents to grant list access
 * @param fetch - Authenticated fetch function
 * @throws Error if the PUT request fails
 *
 * @public
 */
export async function writeListOnlyAcl(
  aclUri: string,
  containerUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  await writeAclDocument(aclUri, buildListOnlyAclTurtle(containerUri, ownerWebId, agentWebIds), fetch);
}

/**
 * Builds ACL Turtle for a single resource.
 *
 * @remarks
 * Grantees can read just that document; no container defaults are set.
 *
 * @param resourceUri - URI of the resource
 * @param ownerWebId - WebID of the owner
 * @param agentWebIds - WebIDs of agents to grant read access
 * @returns Serialized Turtle ACL document
 *
 * @public
 */
export function buildResourceAclTurtle(resourceUri: string, ownerWebId: string, agentWebIds: string[]): string {
  return serializeTurtle([
    ...ownerQuads("#owner", resourceUri, ownerWebId, false),
    ...agentWebIds.flatMap((webId, index) => agentReadQuads(`#read-${index}`, resourceUri, webId, false)),
  ], ACL_PREFIXES);
}

/**
 * Builds ACL Turtle granting read access to a container and its children.
 *
 * @remarks
 * Uses `acl:default` so shared users can read everything inside the container.
 *
 * @param containerUri - URI of the container
 * @param ownerWebId - WebID of the owner
 * @param agentWebIds - WebIDs of agents to grant read access
 * @returns Serialized Turtle ACL document
 *
 * @public
 */
export function buildAclTurtle(containerUri: string, ownerWebId: string, agentWebIds: string[]): string {
  return serializeTurtle([
    ...ownerQuads("#owner", containerUri, ownerWebId, true),
    ...agentWebIds.flatMap((webId, index) => agentReadQuads(`#read-${index}`, containerUri, webId, true)),
  ], ACL_PREFIXES);
}

/**
 * Writes a container ACL granting read access to the container and all its children.
 *
 * @param aclUri - URI of the ACL resource
 * @param containerUri - URI of the container being protected
 * @param ownerWebId - WebID of the owner
 * @param agentWebIds - WebIDs of agents to grant read access
 * @param fetch - Authenticated fetch function
 * @throws Error if the PUT request fails
 *
 * @public
 */
export async function writeAcl(
  aclUri: string,
  containerUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  await writeAclDocument(aclUri, buildAclTurtle(containerUri, ownerWebId, agentWebIds), fetch);
}

/**
 * Writes an ACL for a single resource.
 *
 * @remarks
 * Does not set `acl:default`, so children are not affected.
 *
 * @param aclUri - URI of the ACL resource
 * @param resourceUri - URI of the resource being protected
 * @param ownerWebId - WebID of the owner
 * @param agentWebIds - WebIDs of agents to grant read access
 * @param fetch - Authenticated fetch function
 * @throws Error if the PUT request fails
 *
 * @public
 */
export async function writeResourceAcl(
  aclUri: string,
  resourceUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  await writeAclDocument(aclUri, buildResourceAclTurtle(resourceUri, ownerWebId, agentWebIds), fetch);
}

/**
 * Adds a contact to the container's ACL with read access (and `acl:default`)
 * unless they are already a grantee.
 *
 * @public
 */
export async function grantContainerReadAccess(
  containerUri: string,
  ownerWebId: string,
  contactWebId: string,
  fetch: FetchFn
): Promise<void> {
  const aclUri = await discoverAclUri(containerUri, fetch);
  const existingAgents = await readAclAgents(aclUri, fetch);
  if (existingAgents.includes(contactWebId)) return;
  await writeAcl(aclUri, containerUri, ownerWebId, [...existingAgents, contactWebId], fetch);
}

/**
 * Best-effort grant of catalog read + app-container list-only access so the
 * contact can browse the owner's full file listing. Errors are swallowed.
 *
 * @public
 */
export async function ensureDiscoveryAccess(
  catalogUri: string,
  appContainerUri: string,
  ownerWebId: string,
  contactWebId: string,
  fetch: FetchFn
): Promise<void> {
  try {
    const catalogAclUri = await discoverAclUri(catalogUri, fetch);
    const existingCatalogAgents = await readAclAgents(catalogAclUri, fetch);
    if (!existingCatalogAgents.includes(contactWebId)) {
      await writeResourceAcl(catalogAclUri, catalogUri, ownerWebId, [...existingCatalogAgents, contactWebId], fetch);
    }
  } catch {
    // best-effort; one side failing should not block the other
  }
  try {
    const appAclUri = await discoverAclUri(appContainerUri, fetch);
    const existingAppAgents = await readAclAgents(appAclUri, fetch);
    if (!existingAppAgents.includes(contactWebId)) {
      await writeListOnlyAcl(appAclUri, appContainerUri, ownerWebId, [...existingAppAgents, contactWebId], fetch);
    }
  } catch {
    // best-effort
  }
}
