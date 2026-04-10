import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import {
  discoverInboxUriFromProfile,
  buildAccessRequestMessage,
  buildAccessRejectionMessage,
  parseContainedResourceUris,
  parseAccessRequestMessage,
  parseAccessRejectionMessage,
} from '../inboxMessages-file/inboxMessages';

const LDP_NS = "http://www.w3.org/ns/ldp#";
const ACL_NS = "http://www.w3.org/ns/auth/acl#";
const SOLID_ACCESS_NS = "http://www.w3.org/ns/solid/access#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

function parseQuads(turtle: string, baseIRI: string) {
  return new Parser({ baseIRI }).parse(turtle);
}

// ─── discoverInboxUriFromProfile ────────────────────────────────────────────

describe("discoverInboxUriFromProfile", () => {
  it("returns absolute inbox URI from profile", () => {
    const turtle = `
      @prefix ldp: <${LDP_NS}> .
      <https://alice.example/profile/card#me> ldp:inbox <https://alice.example/inbox/> .
    `;
    const result = discoverInboxUriFromProfile(
      "https://alice.example/profile/card",
      "https://alice.example/profile/card#me",
      turtle
    );
    expect(result).toBe("https://alice.example/inbox/");
  });

  it("resolves relative inbox URI against the profile document URI", () => {
    const turtle = `
      @prefix ldp: <${LDP_NS}> .
      <https://alice.example/profile/card#me> ldp:inbox </inbox/> .
    `;
    const result = discoverInboxUriFromProfile(
      "https://alice.example/profile/card",
      "https://alice.example/profile/card#me",
      turtle
    );
    expect(result).toBe("https://alice.example/inbox/");
  });

  it("falls back to any ldp:inbox triple when the subject does not match the webId", () => {
    const turtle = `
      @prefix ldp: <${LDP_NS}> .
      <https://alice.example/profile/card> ldp:inbox <https://alice.example/inbox/> .
    `;
    const result = discoverInboxUriFromProfile(
      "https://alice.example/profile/card",
      "https://alice.example/profile/card#me",
      turtle
    );
    expect(result).toBe("https://alice.example/inbox/");
  });

  it("throws when no ldp:inbox triple exists", () => {
    const turtle = `
      @prefix ldp: <${LDP_NS}> .
      <https://alice.example/profile/card#me> <http://xmlns.com/foaf/0.1/name> "Alice" .
    `;
    expect(() =>
      discoverInboxUriFromProfile(
        "https://alice.example/profile/card",
        "https://alice.example/profile/card#me",
        turtle
      )
    ).toThrow("No ldp:inbox found");
  });

  it("resolves a literal inbox value as relative URI against the profile document", () => {
    // When the inbox value is a literal (not a NamedNode), isAbsoluteUri returns false
    // and new URL(raw, profileDocUri) resolves it
    const turtle = `
      @prefix ldp: <${LDP_NS}> .
      <https://alice.example/profile/card#me> ldp:inbox "inbox/" .
    `;
    const result = discoverInboxUriFromProfile(
      "https://alice.example/profile/card",
      "https://alice.example/profile/card#me",
      turtle
    );
    expect(result).toBe("https://alice.example/profile/inbox/");
  });
});

// ─── buildAccessRequestMessage ───────────────────────────────────────────────

describe("buildAccessRequestMessage", () => {
  it("builds a catalog access request with the correct RDF type", () => {
    const turtle = buildAccessRequestMessage(
      "catalog",
      "https://requester.example/profile/card#me",
      "https://owner.example/profile/card#me"
    );
    const quads = parseQuads(turtle, "https://owner.example/inbox/msg1");
    expect(
      quads.some(
        (quad) =>
          quad.predicate.value === RDF_TYPE &&
          quad.object.value === `${SOLID_ACCESS_NS}CatalogAccessRequest`
      )
    ).toBe(true);
  });

  it("builds a file access request with the correct RDF type", () => {
    const turtle = buildAccessRequestMessage(
      "file",
      "https://requester.example/profile/card#me",
      "https://owner.example/files/videos/"
    );
    const quads = parseQuads(turtle, "https://owner.example/inbox/msg2");
    expect(
      quads.some(
        (quad) =>
          quad.predicate.value === RDF_TYPE &&
          quad.object.value === `${SOLID_ACCESS_NS}FileAccessRequest`
      )
    ).toBe(true);
  });

  it("includes acl:agent pointing to the requester", () => {
    const requesterWebId = "https://requester.example/profile/card#me";
    const turtle = buildAccessRequestMessage("catalog", requesterWebId, "https://owner.example/profile/card#me");
    const quads = parseQuads(turtle, "https://owner.example/inbox/msg");
    expect(
      quads.some(
        (quad) => quad.predicate.value === `${ACL_NS}agent` && quad.object.value === requesterWebId
      )
    ).toBe(true);
  });

  it("includes acl:accessTo pointing to the target resource", () => {
    const accessTo = "https://owner.example/files/videos/";
    const turtle = buildAccessRequestMessage("file", "https://requester.example/profile/card#me", accessTo);
    const quads = parseQuads(turtle, "https://owner.example/inbox/msg");
    expect(
      quads.some(
        (quad) => quad.predicate.value === `${ACL_NS}accessTo` && quad.object.value === accessTo
      )
    ).toBe(true);
  });

  it("includes a dcterms:created timestamp", () => {
    const turtle = buildAccessRequestMessage("catalog", "https://r.example/#me", "https://o.example/#me");
    const quads = parseQuads(turtle, "https://o.example/inbox/msg");
    expect(
      quads.some((quad) => quad.predicate.value === "http://purl.org/dc/terms/created")
    ).toBe(true);
  });
});

// ─── buildAccessRejectionMessage ─────────────────────────────────────────────

describe("buildAccessRejectionMessage", () => {
  it("builds a rejection with the correct RDF type", () => {
    const turtle = buildAccessRejectionMessage("https://owner.example/files/videos/");
    const quads = parseQuads(turtle, "https://requester.example/inbox/msg");
    expect(
      quads.some(
        (quad) =>
          quad.predicate.value === RDF_TYPE &&
          quad.object.value === `${SOLID_ACCESS_NS}AccessRejected`
      )
    ).toBe(true);
  });

  it("includes acl:accessTo with the rejected resource URI", () => {
    const accessTo = "https://owner.example/files/videos/";
    const turtle = buildAccessRejectionMessage(accessTo);
    const quads = parseQuads(turtle, "https://requester.example/inbox/msg");
    expect(
      quads.some(
        (quad) => quad.predicate.value === `${ACL_NS}accessTo` && quad.object.value === accessTo
      )
    ).toBe(true);
  });
});

// ─── parseContainedResourceUris ───────────────────────────────────────────────

describe("parseContainedResourceUris", () => {
  it("returns all ldp:contains object URIs", () => {
    const inboxUri = "https://alice.example/inbox/";
    const turtle = `
      @prefix ldp: <${LDP_NS}> .
      <${inboxUri}> ldp:contains <${inboxUri}msg1>, <${inboxUri}msg2> .
    `;
    const result = parseContainedResourceUris(inboxUri, turtle);
    expect(result).toContain(`${inboxUri}msg1`);
    expect(result).toContain(`${inboxUri}msg2`);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when no ldp:contains triples are present", () => {
    const inboxUri = "https://alice.example/inbox/";
    const turtle = `@prefix ldp: <${LDP_NS}> . <${inboxUri}> a ldp:Container .`;
    expect(parseContainedResourceUris(inboxUri, turtle)).toEqual([]);
  });
});

// ─── parseAccessRequestMessage ────────────────────────────────────────────────

describe("parseAccessRequestMessage", () => {
  it("parses a catalog access request built by buildAccessRequestMessage", () => {
    const messageUri = "https://owner.example/inbox/msg1";
    const requesterWebId = "https://requester.example/profile/card#me";
    const accessTo = "https://owner.example/profile/card#me";

    const turtle = buildAccessRequestMessage("catalog", requesterWebId, accessTo);
    const result = parseAccessRequestMessage(messageUri, turtle);

    expect(result).not.toBeNull();
    expect(result?.messageUri).toBe(messageUri);
    expect(result?.requesterWebId).toBe(requesterWebId);
    expect(result?.accessTo).toBe(accessTo);
    expect(result?.requestType).toBe("catalog");
  });

  it("parses a file access request built by buildAccessRequestMessage", () => {
    const messageUri = "https://owner.example/inbox/msg2";
    const requesterWebId = "https://requester.example/profile/card#me";
    const accessTo = "https://owner.example/files/videos/";

    const turtle = buildAccessRequestMessage("file", requesterWebId, accessTo);
    const result = parseAccessRequestMessage(messageUri, turtle);

    expect(result).not.toBeNull();
    expect(result?.requestType).toBe("file");
    expect(result?.accessTo).toBe(accessTo);
  });

  it("returns null for a non-request message", () => {
    const turtle = `
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      <> foaf:name "Not a request" .
    `;
    expect(parseAccessRequestMessage("https://owner.example/inbox/msg", turtle)).toBeNull();
  });

  it("returns null when acl:agent is missing", () => {
    const turtle = `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix acl: <${ACL_NS}> .
      @prefix solid-access: <${SOLID_ACCESS_NS}> .
      <> rdf:type solid-access:CatalogAccessRequest ;
         acl:accessTo <https://owner.example/#me> .
    `;
    expect(parseAccessRequestMessage("https://owner.example/inbox/msg", turtle)).toBeNull();
  });

  it("returns empty timestamp when dcterms:created is missing", () => {
    const turtle = `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix acl: <${ACL_NS}> .
      @prefix solid-access: <${SOLID_ACCESS_NS}> .
      <> rdf:type solid-access:CatalogAccessRequest ;
         acl:agent <https://requester.example/profile/card#me> ;
         acl:accessTo <https://owner.example/profile/card#me> .
    `;
    const result = parseAccessRequestMessage("https://owner.example/inbox/msg", turtle);
    expect(result).not.toBeNull();
    expect(result?.timestamp).toBe("");
  });
});

// ─── parseAccessRejectionMessage ─────────────────────────────────────────────

describe("parseAccessRejectionMessage", () => {
  it("parses a rejection message built by buildAccessRejectionMessage", () => {
    const messageUri = "https://requester.example/inbox/msg1";
    const accessTo = "https://owner.example/files/videos/";

    const turtle = buildAccessRejectionMessage(accessTo);
    const result = parseAccessRejectionMessage(messageUri, turtle);

    expect(result).not.toBeNull();
    expect(result?.messageUri).toBe(messageUri);
    expect(result?.accessTo).toBe(accessTo);
  });

  it("returns null for a non-rejection message", () => {
    const turtle = `
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      <> foaf:name "Not a rejection" .
    `;
    expect(parseAccessRejectionMessage("https://requester.example/inbox/msg", turtle)).toBeNull();
  });

  it("returns null when acl:accessTo is missing from the rejection", () => {
    const turtle = `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix solid-access: <${SOLID_ACCESS_NS}> .
      <> rdf:type solid-access:AccessRejected .
    `;
    expect(parseAccessRejectionMessage("https://requester.example/inbox/msg", turtle)).toBeNull();
  });
});
