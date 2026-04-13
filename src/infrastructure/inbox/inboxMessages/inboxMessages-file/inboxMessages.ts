/**
 * Inbox message parsing and serialization for Solid access requests.
 *
 * @remarks
 * Handles LDP inbox discovery and access request/rejection message formats
 * using the `solid-access` vocabulary.
 *
 * @packageDocumentation
 */

import { DataFactory, Parser } from "n3";
import { serializeTurtle } from "@/infrastructure/solid/rdfUtils";
import { RDF_NAMESPACES } from "@/config";
import { isAbsoluteUri } from "@/shared/utils";

const { namedNode, literal, quad } = DataFactory;

const RDF_TYPE = namedNode(`${RDF_NAMESPACES.RDF}type`);
const DCTERMS_CREATED = namedNode(`${RDF_NAMESPACES.DCTERMS}created`);
const XSD_DATETIME = namedNode(`${RDF_NAMESPACES.XSD}dateTime`);

const LDP_INBOX = namedNode(`${RDF_NAMESPACES.LDP}inbox`);
const LDP_CONTAINS = namedNode(`${RDF_NAMESPACES.LDP}contains`);
const CATALOG_ACCESS_REQUEST_TYPE = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}CatalogAccessRequest`);
const FILE_ACCESS_REQUEST_TYPE = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}FileAccessRequest`);
const ACCESS_REJECTION_TYPE = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}AccessRejected`);
const ACL_AGENT = namedNode(`${RDF_NAMESPACES.ACL}agent`);
const ACL_ACCESS_TO = namedNode(`${RDF_NAMESPACES.ACL}accessTo`);

const WRITER_PREFIXES = {
  acl: RDF_NAMESPACES.ACL,
  dcterms: RDF_NAMESPACES.DCTERMS,
  "solid-access": RDF_NAMESPACES.SOLID_ACCESS,
  xsd: RDF_NAMESPACES.XSD,
};

/**
 * Type of access request: catalog-level or file-level.
 *
 * @public
 */
export type AccessRequestType = "catalog" | "file";

/**
 * Parsed access request from an inbox message.
 *
 * @public
 */
export type AccessRequest = {
  messageUri: string;
  requesterWebId: string;
  /** Contact WebID for catalog requests, or file container URI for file requests. */
  accessTo: string;
  requestType: AccessRequestType;
  timestamp: string;
};

/**
 * Parsed access rejection from an inbox message.
 *
 * @public
 */
export type AccessRejection = {
  messageUri: string;
  /** Original WebID or resource URI tied to the rejected request. */
  accessTo: string;
};

/**
 * Extracts the inbox URI from a profile document.
 *
 * @param profileDocUri - URI of the profile document
 * @param webId - The user's WebID
 * @param turtle - Raw Turtle content of the profile
 * @returns Resolved inbox URI
 * @throws Error if no `ldp:inbox` is found
 *
 * @public
 */
export function discoverInboxUriFromProfile(profileDocUri: string, webId: string, turtle: string): string {
  const quads = new Parser({ baseIRI: profileDocUri }).parse(turtle);
  const inboxQuad =
    quads.find((quad) => quad.subject.value === webId && quad.predicate.equals(LDP_INBOX)) ??
    quads.find((quad) => quad.predicate.equals(LDP_INBOX));

  if (!inboxQuad) {
    throw new Error(`No ldp:inbox found in profile for ${webId}`);
  }

  const raw = inboxQuad.object.value;
  return isAbsoluteUri(raw) ? raw : new URL(raw, profileDocUri).href;
}

/**
 * Builds a Turtle message for a catalog or file access request.
 *
 * @param type - Whether this is a catalog or file access request
 * @param requesterWebId - WebID of the requester
 * @param accessTo - Target resource or contact WebID
 * @returns Serialized Turtle message
 *
 * @public
 */
export function buildAccessRequestMessage(
  type: AccessRequestType,
  requesterWebId: string,
  accessTo: string
): string {
  const typeNode = type === "catalog" ? CATALOG_ACCESS_REQUEST_TYPE : FILE_ACCESS_REQUEST_TYPE;
  return serializeTurtle([
    quad(namedNode(""), RDF_TYPE, typeNode),
    quad(namedNode(""), ACL_AGENT, namedNode(requesterWebId)),
    quad(namedNode(""), ACL_ACCESS_TO, namedNode(accessTo)),
    quad(namedNode(""), DCTERMS_CREATED, literal(new Date().toISOString(), XSD_DATETIME)),
  ], WRITER_PREFIXES);
}

/**
 * Builds a Turtle message for a rejected access request.
 *
 * @param accessTo - The resource or WebID being rejected
 * @returns Serialized Turtle message
 *
 * @public
 */
export function buildAccessRejectionMessage(accessTo: string): string {
  return serializeTurtle([
    quad(namedNode(""), RDF_TYPE, ACCESS_REJECTION_TYPE),
    quad(namedNode(""), ACL_ACCESS_TO, namedNode(accessTo)),
    quad(namedNode(""), DCTERMS_CREATED, literal(new Date().toISOString(), XSD_DATETIME)),
  ], WRITER_PREFIXES);
}

/**
 * Returns the resource URIs contained in an inbox listing.
 *
 * @param inboxUri - URI of the inbox container
 * @param turtle - Raw Turtle content of the inbox listing
 * @returns Array of contained resource URIs
 *
 * @public
 */
export function parseContainedResourceUris(inboxUri: string, turtle: string): string[] {
  return new Parser({ baseIRI: inboxUri })
    .parse(turtle)
    .filter((quad) => quad.predicate.equals(LDP_CONTAINS))
    .map((quad) => quad.object.value);
}

/**
 * Parses a Turtle inbox message as an access request.
 *
 * @param messageUri - URI of the inbox message
 * @param turtle - Raw Turtle content of the message
 * @returns Parsed access request, or null if not a valid request
 *
 * @public
 */
export function parseAccessRequestMessage(messageUri: string, turtle: string): AccessRequest | null {
  const quads = new Parser({ baseIRI: messageUri }).parse(turtle);
  const typeQuad = quads.find(
    (quad) =>
      quad.predicate.equals(RDF_TYPE) &&
      (quad.object.equals(CATALOG_ACCESS_REQUEST_TYPE) || quad.object.equals(FILE_ACCESS_REQUEST_TYPE))
  );

  if (!typeQuad) return null;

  const agentQuad = quads.find((quad) => quad.predicate.equals(ACL_AGENT));
  const accessToQuad = quads.find((quad) => quad.predicate.equals(ACL_ACCESS_TO));
  if (!agentQuad || !accessToQuad) return null;

  return {
    messageUri,
    requesterWebId: agentQuad.object.value,
    accessTo: accessToQuad.object.value,
    requestType: typeQuad.object.equals(FILE_ACCESS_REQUEST_TYPE) ? "file" : "catalog",
    timestamp: quads.find((quad) => quad.predicate.equals(DCTERMS_CREATED))?.object.value ?? "",
  };
}

/**
 * Parses a Turtle inbox message as an access rejection.
 *
 * @param messageUri - URI of the inbox message
 * @param turtle - Raw Turtle content of the message
 * @returns Parsed access rejection, or null if not a valid rejection
 *
 * @public
 */
export function parseAccessRejectionMessage(messageUri: string, turtle: string): AccessRejection | null {
  const quads = new Parser({ baseIRI: messageUri }).parse(turtle);
  const isRejection = quads.some(
    (quad) => quad.predicate.equals(RDF_TYPE) && quad.object.equals(ACCESS_REJECTION_TYPE)
  );
  if (!isRejection) return null;

  const accessToQuad = quads.find((quad) => quad.predicate.equals(ACL_ACCESS_TO));
  if (!accessToQuad) return null;

  return { messageUri, accessTo: accessToQuad.object.value };
}

