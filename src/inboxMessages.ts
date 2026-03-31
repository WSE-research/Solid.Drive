import { DataFactory, Parser, Writer } from "n3";
import type { Quad } from "n3";

const { namedNode, literal, quad } = DataFactory;
// TODO: Move RDF helpers into a separate file
const LDP_NS = "http://www.w3.org/ns/ldp#";
const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const DCTERMS_CREATED = namedNode("http://purl.org/dc/terms/created");
const ACL_NS = "http://www.w3.org/ns/auth/acl#";
const SOLID_ACCESS_NS = "http://www.w3.org/ns/solid/access#";
const XSD_DATETIME = namedNode("http://www.w3.org/2001/XMLSchema#dateTime");

const LDP_INBOX = namedNode(`${LDP_NS}inbox`);
const LDP_CONTAINS = namedNode(`${LDP_NS}contains`);
const CATALOG_ACCESS_REQUEST_TYPE = namedNode(`${SOLID_ACCESS_NS}CatalogAccessRequest`);
const FILE_ACCESS_REQUEST_TYPE = namedNode(`${SOLID_ACCESS_NS}FileAccessRequest`);
const ACCESS_REJECTION_TYPE = namedNode(`${SOLID_ACCESS_NS}AccessRejected`);
const ACL_AGENT = namedNode(`${ACL_NS}agent`);
const ACL_ACCESS_TO = namedNode(`${ACL_NS}accessTo`);

const WRITER_PREFIXES = {
  acl: ACL_NS,
  dcterms: "http://purl.org/dc/terms/",
  "solid-access": SOLID_ACCESS_NS,
  xsd: "http://www.w3.org/2001/XMLSchema#",
};
// TODO: Move shared message types into a separate file
export type AccessRequestType = "catalog" | "file";

export type AccessRequest = {
  messageUri: string;
  requesterWebId: string;
  // Contact WebID for catalog requests, or file container URI for file requests.
  accessTo: string;
  requestType: AccessRequestType;
  timestamp: string;
};

export type AccessRejection = {
  messageUri: string;
  // Original WebID or resource URI tied to the rejected request
  accessTo: string;
};

/**
 * Extract the inbox URI from a profile document
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
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : new URL(raw, profileDocUri).href;
}

/**
 * Build a Turtle message for a catalog or file access request
 */
export function buildAccessRequestMessage(
  type: AccessRequestType,
  requesterWebId: string,
  accessTo: string
): string {
  const typeNode = type === "catalog" ? CATALOG_ACCESS_REQUEST_TYPE : FILE_ACCESS_REQUEST_TYPE;
  return writeMessage([
    quad(namedNode(""), RDF_TYPE, typeNode),
    quad(namedNode(""), ACL_AGENT, namedNode(requesterWebId)),
    quad(namedNode(""), ACL_ACCESS_TO, namedNode(accessTo)),
    quad(namedNode(""), DCTERMS_CREATED, literal(new Date().toISOString(), XSD_DATETIME)),
  ]);
}

/**
 * Build a Turtle message for a rejected access request
 */
export function buildAccessRejectionMessage(accessTo: string): string {
  return writeMessage([
    quad(namedNode(""), RDF_TYPE, ACCESS_REJECTION_TYPE),
    quad(namedNode(""), ACL_ACCESS_TO, namedNode(accessTo)),
    quad(namedNode(""), DCTERMS_CREATED, literal(new Date().toISOString(), XSD_DATETIME)),
  ]);
}

/**
 * Return the resource URIs contained in an inbox listing
 */
export function parseContainedResourceUris(inboxUri: string, turtle: string): string[] {
  return new Parser({ baseIRI: inboxUri })
    .parse(turtle)
    .filter((quad) => quad.predicate.equals(LDP_CONTAINS))
    .map((quad) => quad.object.value);
}

/**
 * Parse a Turtle inbox message as an access request
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
 * Parse a Turtle inbox message as an access rejection
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
 * Serialize quads as Turtle
 */
function writeMessage(quads: Quad[]): string {
  let turtle = "";
  const writer = new Writer({ prefixes: WRITER_PREFIXES });
  writer.addQuads(quads);
  writer.end((_err, result) => {
    turtle = result;
  });
  return turtle;
}
