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
const TYPE_ACCESS_REQUEST_TYPE = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}TypeAccessRequest`);
const ACCESS_REJECTION_TYPE = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}AccessRejected`);
const ACCESS_APPROVAL_TYPE = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}AccessApproved`);
const ACL_AGENT = namedNode(`${RDF_NAMESPACES.ACL}agent`);
const ACL_ACCESS_TO = namedNode(`${RDF_NAMESPACES.ACL}accessTo`);
const SOLID_ACCESS_FOR_CLASS = namedNode(`${RDF_NAMESPACES.SOLID_ACCESS}forClass`);

const WRITER_PREFIXES = {
  acl: RDF_NAMESPACES.ACL,
  dcterms: RDF_NAMESPACES.DCTERMS,
  "solid-access": RDF_NAMESPACES.SOLID_ACCESS,
  xsd: RDF_NAMESPACES.XSD,
};

/**
 * Type of access request: catalog-level, file-level, or type-level (a category
 * defined by a schema.org class URI, e.g. all Image files).
 *
 * @public
 */
export type AccessRequestType = "catalog" | "file" | "type";

/**
 * Parsed access request from an inbox message.
 *
 * @public
 */
export type AccessRequest = {
  messageUri: string;
  requesterWebId: string;
  /** Contact WebID for catalog requests, file container URI for file requests, empty for type requests. */
  accessTo: string;
  requestType: AccessRequestType;
  /** Schema.org class URI when requestType is "type"; undefined otherwise. */
  forClass?: string;
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
 * Parsed access approval from an inbox message. Mirrors
 * {@link AccessRejection}: the owner posts one to the requester's inbox
 * when they approve, so the requester learns the outcome of *this*
 * request rather than inferring it from catalog reachability.
 *
 * @public
 */
export type AccessApproval = {
  messageUri: string;
  /** WebID or resource URI the request was approved for. */
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
 * Builds a Turtle message for a catalog, file, or type access request.
 *
 * @param type - Whether this is a catalog, file, or type access request
 * @param requesterWebId - WebID of the requester
 * @param target - For "catalog"/"file": the contact WebID or file container URI.
 *                 For "type": the schema.org class URI of the requested category.
 * @returns Serialized Turtle message
 *
 * @public
 */
export function buildAccessRequestMessage(
  type: AccessRequestType,
  requesterWebId: string,
  target: string
): string {
  const created = quad(namedNode(""), DCTERMS_CREATED, literal(new Date().toISOString(), XSD_DATETIME));
  const agent = quad(namedNode(""), ACL_AGENT, namedNode(requesterWebId));

  if (type === "type") {
    return serializeTurtle([
      quad(namedNode(""), RDF_TYPE, TYPE_ACCESS_REQUEST_TYPE),
      agent,
      quad(namedNode(""), SOLID_ACCESS_FOR_CLASS, namedNode(target)),
      created,
    ], WRITER_PREFIXES);
  }

  const typeNode = type === "catalog" ? CATALOG_ACCESS_REQUEST_TYPE : FILE_ACCESS_REQUEST_TYPE;
  return serializeTurtle([
    quad(namedNode(""), RDF_TYPE, typeNode),
    agent,
    quad(namedNode(""), ACL_ACCESS_TO, namedNode(target)),
    created,
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
 * Builds a Turtle message for an approved access request.
 *
 * @param accessTo - The resource or WebID being approved
 * @returns Serialized Turtle message
 *
 * @public
 */
export function buildAccessApprovalMessage(accessTo: string): string {
  return serializeTurtle([
    quad(namedNode(""), RDF_TYPE, ACCESS_APPROVAL_TYPE),
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
      (
        quad.object.equals(CATALOG_ACCESS_REQUEST_TYPE) ||
        quad.object.equals(FILE_ACCESS_REQUEST_TYPE) ||
        quad.object.equals(TYPE_ACCESS_REQUEST_TYPE)
      )
  );

  if (!typeQuad) return null;

  const agentQuad = quads.find((quad) => quad.predicate.equals(ACL_AGENT));
  if (!agentQuad) return null;

  const timestamp = quads.find((quad) => quad.predicate.equals(DCTERMS_CREATED))?.object.value ?? "";

  if (typeQuad.object.equals(TYPE_ACCESS_REQUEST_TYPE)) {
    const forClassQuad = quads.find((quad) => quad.predicate.equals(SOLID_ACCESS_FOR_CLASS));
    if (!forClassQuad) return null;
    return {
      messageUri,
      requesterWebId: agentQuad.object.value,
      accessTo: "",
      requestType: "type",
      forClass: forClassQuad.object.value,
      timestamp,
    };
  }

  const accessToQuad = quads.find((quad) => quad.predicate.equals(ACL_ACCESS_TO));
  if (!accessToQuad) return null;

  return {
    messageUri,
    requesterWebId: agentQuad.object.value,
    accessTo: accessToQuad.object.value,
    requestType: typeQuad.object.equals(FILE_ACCESS_REQUEST_TYPE) ? "file" : "catalog",
    timestamp,
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

/**
 * Parses a Turtle inbox message as an access approval.
 *
 * @param messageUri - URI of the inbox message
 * @param turtle - Raw Turtle content of the message
 * @returns Parsed access approval, or null if not a valid approval
 *
 * @public
 */
export function parseAccessApprovalMessage(messageUri: string, turtle: string): AccessApproval | null {
  const quads = new Parser({ baseIRI: messageUri }).parse(turtle);
  const isApproval = quads.some(
    (quad) => quad.predicate.equals(RDF_TYPE) && quad.object.equals(ACCESS_APPROVAL_TYPE)
  );
  if (!isApproval) return null;

  const accessToQuad = quads.find((quad) => quad.predicate.equals(ACL_ACCESS_TO));
  if (!accessToQuad) return null;

  return { messageUri, accessTo: accessToQuad.object.value };
}

