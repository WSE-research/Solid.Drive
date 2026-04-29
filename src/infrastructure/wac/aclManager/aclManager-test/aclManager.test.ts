
import { describe, it, expect, vi } from "vitest";
import { Parser } from "n3";
import {
  buildAclTurtle,
  buildListOnlyAclTurtle,
  buildResourceAclTurtle,
  discoverAclUri,
  ensureDiscoveryAccess,
  grantContainerReadAccess,
  readAclAgents,
  writeAcl,
  writeListOnlyAcl,
  writeResourceAcl,
} from '../aclManager-file/aclManager';

const ACL_NS = "http://www.w3.org/ns/auth/acl#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

function parseAclTurtle(turtle: string, baseIRI = "https://pod.example/.acl") {
  return new Parser({ baseIRI }).parse(turtle);
}

function getModesForAgent(turtle: string, agentWebId: string, baseIRI?: string): string[] {
  const quads = parseAclTurtle(turtle, baseIRI);
  const authSubjects = new Set(
    quads
      .filter((quad) => quad.predicate.value === RDF_TYPE && quad.object.value === `${ACL_NS}Authorization`)
      .map((quad) => quad.subject.value)
  );
  const modes: string[] = [];
  for (const subject of authSubjects) {
    const hasAgent = quads.some((quad) => quad.subject.value === subject && quad.predicate.value === `${ACL_NS}agent` && quad.object.value === agentWebId);
    if (!hasAgent) continue;
    quads
      .filter((quad) => quad.subject.value === subject && quad.predicate.value === `${ACL_NS}mode`)
      .forEach((quad) => modes.push(quad.object.value));
  }
  return modes;
}

const makeFetch = (responses: Record<string, { status: number; headers?: Record<string, string>; body?: string }>) =>
  vi.fn(async (url: RequestInfo, init?: RequestInit) => {
    const urlStr = url as string;
    const key = `${init?.method ?? "GET"} ${urlStr}`;
    const mockedResponse = responses[key] ?? responses[urlStr] ?? { status: 404 };
    return {
      ok: mockedResponse.status >= 200 && mockedResponse.status < 300,
      status: mockedResponse.status,
      headers: { get: (header: string) => mockedResponse.headers?.[header] ?? null },
      text: async () => mockedResponse.body ?? "",
    } as unknown as Response;
  });

describe("discoverAclUri", () => {
  it("parses absolute ACL URI from Link header", async () => {
    const mockFetch = makeFetch({
      "HEAD https://pod.example/file/": {
        status: 200,
        headers: { Link: '<https://pod.example/file/.acl>; rel="acl"' },
      },
    });
    const resolvedAclUri = await discoverAclUri("https://pod.example/file/", mockFetch);
    expect(resolvedAclUri).toBe("https://pod.example/file/.acl");
  });

  it("resolves relative ACL URI against container", async () => {
    const mockFetch = makeFetch({
      "HEAD https://pod.example/file/": {
        status: 200,
        headers: { Link: '<.acl>; rel="acl"' },
      },
    });
    const resolvedAclUri = await discoverAclUri("https://pod.example/file/", mockFetch);
    expect(resolvedAclUri).toBe("https://pod.example/file/.acl");
  });

  it("throws when no Link header present", async () => {
    const mockFetch = makeFetch({ "HEAD https://pod.example/file/": { status: 200 } });
    await expect(discoverAclUri("https://pod.example/file/", mockFetch)).rejects.toThrow("No ACL link header");
  });

  it("throws when HEAD request fails with non-2xx", async () => {
    const mockFetch = makeFetch({ "HEAD https://pod.example/file/": { status: 403 } });
    await expect(discoverAclUri("https://pod.example/file/", mockFetch)).rejects.toThrow("403");
  });
});

describe("readAclAgents", () => {
  it("returns empty array when ACL file does not exist", async () => {
    const mockFetch = makeFetch({ "https://pod.example/file/.acl": { status: 404 } });
    const resolvedAgents = await readAclAgents("https://pod.example/file/.acl", mockFetch);
    expect(resolvedAgents).toEqual([]);
  });

  it("parses shared agents from ACL turtle", async () => {
    const turtle = buildAclTurtle(
      "https://pod.example/file/",
      "https://owner.example/profile/card#me",
      ["https://alice.example/profile/card#me", "https://bob.example/profile/card#me"]
    );
    const mockFetch = makeFetch({ "https://pod.example/file/.acl": { status: 200, body: turtle } });
    const resolvedAgents = await readAclAgents("https://pod.example/file/.acl", mockFetch);
    expect(resolvedAgents).toContain("https://alice.example/profile/card#me");
    expect(resolvedAgents).toContain("https://bob.example/profile/card#me");
    expect(resolvedAgents).not.toContain("https://owner.example/profile/card#me");
  });

  it("returns empty array when no read-only agents exist", async () => {
    const turtle = buildAclTurtle("https://pod.example/file/", "https://owner.example/profile/card#me", []);
    const mockFetch = makeFetch({ "https://pod.example/file/.acl": { status: 200, body: turtle } });
    const resolvedAgents = await readAclAgents("https://pod.example/file/.acl", mockFetch);
    expect(resolvedAgents).toEqual([]);
  });

  it("throws when GET returns non-ok status other than 404", async () => {
    const mockFetch = makeFetch({ "https://pod.example/file/.acl": { status: 403 } });
    await expect(readAclAgents("https://pod.example/file/.acl", mockFetch)).rejects.toThrow("403");
  });
});

describe("buildAclTurtle", () => {
  it("grants the owner Read, Write, and Control over the container", () => {
    const turtle = buildAclTurtle("https://pod.example/file/", "https://owner.example/#me", []);
    const ownerModes = getModesForAgent(turtle, "https://owner.example/#me");
    expect(ownerModes).toContain(`${ACL_NS}Read`);
    expect(ownerModes).toContain(`${ACL_NS}Write`);
    expect(ownerModes).toContain(`${ACL_NS}Control`);
  });

  it("grants shared agents Read-only access without Write or Control", () => {
    const turtle = buildAclTurtle("https://pod.example/file/", "https://owner.example/#me", ["https://alice.example/#me"]);
    const aliceModes = getModesForAgent(turtle, "https://alice.example/#me");
    expect(aliceModes).toContain(`${ACL_NS}Read`);
    expect(aliceModes).not.toContain(`${ACL_NS}Write`);
    expect(aliceModes).not.toContain(`${ACL_NS}Control`);
  });
});

describe("buildResourceAclTurtle", () => {
  it("omits acl:default so access does not inherit to child resources, while still granting agents Read", () => {
    const turtle = buildResourceAclTurtle("https://pod.example/catalog.ttl", "https://owner.example/#me", ["https://alice.example/#me"]);
    const quads = parseAclTurtle(turtle);
    expect(quads.some((quad) => quad.predicate.value === `${ACL_NS}default`)).toBe(false);
    const aliceModes = getModesForAgent(turtle, "https://alice.example/#me");
    expect(aliceModes).toContain(`${ACL_NS}Read`);
  });
});

describe("writeAcl", () => {
  it("sends a PUT request to the ACL URI with text/turtle content-type header", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/file/.acl": { status: 201 } });
    await expect(
      writeAcl("https://pod.example/file/.acl", "https://pod.example/file/", "https://owner.example/#me", [], mockFetch)
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pod.example/file/.acl",
      expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Content-Type": "text/turtle" }) })
    );
  });

  it("throws when PUT fails for container ACL", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/file/.acl": { status: 403 } });
    await expect(
      writeAcl("https://pod.example/file/.acl", "https://pod.example/file/", "https://owner.example/#me", [], mockFetch)
    ).rejects.toThrow("403");
  });
});

describe("writeResourceAcl", () => {
  it("sends a PUT request to the resource ACL URI with text/turtle content-type header", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/catalog.ttl.acl": { status: 201 } });
    await expect(
      writeResourceAcl("https://pod.example/catalog.ttl.acl", "https://pod.example/catalog.ttl", "https://owner.example/#me", [], mockFetch)
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pod.example/catalog.ttl.acl",
      expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Content-Type": "text/turtle" }) })
    );
  });

  it("throws when PUT fails for resource ACL", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/catalog.ttl.acl": { status: 403 } });
    await expect(
      writeResourceAcl("https://pod.example/catalog.ttl.acl", "https://pod.example/catalog.ttl", "https://owner.example/#me", [], mockFetch)
    ).rejects.toThrow("403");
  });
});

// ─── discoverAclUri (additional cases) ───────────────────────────────────────

describe("discoverAclUri – additional cases", () => {
  it("throws when the container URI is not an absolute URL", async () => {
    const mockFetch = makeFetch({});
    await expect(discoverAclUri("not-a-url", mockFetch)).rejects.toThrow(
      "ACL discovery requires an absolute container URI"
    );
  });
});

// ─── buildListOnlyAclTurtle ───────────────────────────────────────────────────

describe("buildListOnlyAclTurtle", () => {
  const containerUri = "https://pod.example/my-app/";
  const ownerWebId = "https://owner.example/profile/card#me";
  const agentWebId = "https://alice.example/profile/card#me";

  it("grants the owner Read, Write, and Control", () => {
    const turtle = buildListOnlyAclTurtle(containerUri, ownerWebId, []);
    const ownerModes = getModesForAgent(turtle, ownerWebId);
    expect(ownerModes).toContain(`${ACL_NS}Read`);
    expect(ownerModes).toContain(`${ACL_NS}Write`);
    expect(ownerModes).toContain(`${ACL_NS}Control`);
  });

  it("grants the agent Read-only access", () => {
    const turtle = buildListOnlyAclTurtle(containerUri, ownerWebId, [agentWebId]);
    const agentModes = getModesForAgent(turtle, agentWebId);
    expect(agentModes).toContain(`${ACL_NS}Read`);
    expect(agentModes).not.toContain(`${ACL_NS}Write`);
    expect(agentModes).not.toContain(`${ACL_NS}Control`);
  });

  it("does NOT set acl:default for the agent so shared access does not inherit into child resources", () => {
    const turtle = buildListOnlyAclTurtle(containerUri, ownerWebId, [agentWebId]);
    const quads = parseAclTurtle(turtle, containerUri);
    const agentQuads = quads.filter(
      (quad) => quad.object.value === agentWebId
    );
    const agentSubjects = new Set(agentQuads.map((quad) => quad.subject.value));
    const hasDefault = quads.some(
      (quad) => agentSubjects.has(quad.subject.value) && quad.predicate.value === `${ACL_NS}default`
    );
    expect(hasDefault).toBe(false);
  });

  it("sets acl:default on the owner authorization so the owner retains access to child resources", () => {
    const turtle = buildListOnlyAclTurtle(containerUri, ownerWebId, []);
    const quads = parseAclTurtle(turtle, containerUri);
    const ownerSubjects = new Set(
      quads.filter((quad) => quad.object.value === ownerWebId).map((quad) => quad.subject.value)
    );
    const hasDefault = quads.some(
      (quad) => ownerSubjects.has(quad.subject.value) && quad.predicate.value === `${ACL_NS}default`
    );
    expect(hasDefault).toBe(true);
  });

  it("generates ACL entries for each agent when multiple agents are provided", () => {
    const bob = "https://bob.example/profile/card#me";
    const turtle = buildListOnlyAclTurtle(containerUri, ownerWebId, [agentWebId, bob]);
    expect(getModesForAgent(turtle, agentWebId)).toContain(`${ACL_NS}Read`);
    expect(getModesForAgent(turtle, bob)).toContain(`${ACL_NS}Read`);
  });
});

// ─── writeListOnlyAcl ─────────────────────────────────────────────────────────

describe("writeListOnlyAcl", () => {
  it("sends a PUT request to the list-only ACL URI with text/turtle content-type header", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/my-app/.acl": { status: 201 } });
    await expect(
      writeListOnlyAcl(
        "https://pod.example/my-app/.acl",
        "https://pod.example/my-app/",
        "https://owner.example/#me",
        [],
        mockFetch
      )
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pod.example/my-app/.acl",
      expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Content-Type": "text/turtle" }) })
    );
  });

  it("throws when PUT fails for list-only ACL", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/my-app/.acl": { status: 403 } });
    await expect(
      writeListOnlyAcl(
        "https://pod.example/my-app/.acl",
        "https://pod.example/my-app/",
        "https://owner.example/#me",
        [],
        mockFetch
      )
    ).rejects.toThrow("403");
  });
});

// ─── grantContainerReadAccess ─────────────────────────────────────────────────

describe("grantContainerReadAccess", () => {
  const containerUri = "https://pod.example/files/doc/";
  const aclUri = "https://pod.example/files/doc/.acl";
  const owner = "https://owner.example/#me";
  const contact = "https://alice.example/#me";

  function aclTurtleWith(agents: string[]): string {
    return buildAclTurtle(containerUri, owner, agents);
  }

  it("writes the contact into the container ACL when missing", async () => {
    const mockFetch = makeFetch({
      [`HEAD ${containerUri}`]: { status: 200, headers: { Link: `<${aclUri}>; rel="acl"` } },
      [aclUri]: { status: 200, body: aclTurtleWith([]) },
      [`PUT ${aclUri}`]: { status: 201 },
    });

    await grantContainerReadAccess(containerUri, owner, contact, mockFetch);

    const putBody = mockFetch.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "PUT")?.[1] as RequestInit;
    expect(putBody.body).toContain(contact);
  });

  it("does not rewrite the ACL when the contact is already a grantee", async () => {
    const mockFetch = makeFetch({
      [`HEAD ${containerUri}`]: { status: 200, headers: { Link: `<${aclUri}>; rel="acl"` } },
      [aclUri]: { status: 200, body: aclTurtleWith([contact]) },
    });

    await grantContainerReadAccess(containerUri, owner, contact, mockFetch);

    const putCalls = mockFetch.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT");
    expect(putCalls).toHaveLength(0);
  });
});

// ─── ensureDiscoveryAccess ────────────────────────────────────────────────────

describe("ensureDiscoveryAccess", () => {
  const catalogUri = "https://pod.example/my-app/catalog.ttl";
  const catalogAclUri = "https://pod.example/my-app/catalog.ttl.acl";
  const appContainerUri = "https://pod.example/my-app/";
  const appAclUri = "https://pod.example/my-app/.acl";
  const owner = "https://owner.example/#me";
  const contact = "https://alice.example/#me";

  it("adds the contact to the catalog ACL (read-only) and to the app container ACL (list-only)", async () => {
    const mockFetch = makeFetch({
      [`HEAD ${catalogUri}`]: { status: 200, headers: { Link: `<${catalogAclUri}>; rel="acl"` } },
      [catalogAclUri]: { status: 200, body: buildResourceAclTurtle(catalogUri, owner, []) },
      [`PUT ${catalogAclUri}`]: { status: 201 },
      [`HEAD ${appContainerUri}`]: { status: 200, headers: { Link: `<${appAclUri}>; rel="acl"` } },
      [appAclUri]: { status: 200, body: buildListOnlyAclTurtle(appContainerUri, owner, []) },
      [`PUT ${appAclUri}`]: { status: 201 },
    });

    await ensureDiscoveryAccess(catalogUri, appContainerUri, owner, contact, mockFetch);

    const puts = mockFetch.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT");
    expect(puts.map((call) => call[0])).toEqual([catalogAclUri, appAclUri]);
    for (const call of puts) {
      expect((call[1] as RequestInit).body).toContain(contact);
    }
  });

  it("is idempotent — no PUTs when the contact already has discovery access", async () => {
    const mockFetch = makeFetch({
      [`HEAD ${catalogUri}`]: { status: 200, headers: { Link: `<${catalogAclUri}>; rel="acl"` } },
      [catalogAclUri]: { status: 200, body: buildResourceAclTurtle(catalogUri, owner, [contact]) },
      [`HEAD ${appContainerUri}`]: { status: 200, headers: { Link: `<${appAclUri}>; rel="acl"` } },
      [appAclUri]: { status: 200, body: buildListOnlyAclTurtle(appContainerUri, owner, [contact]) },
    });

    await ensureDiscoveryAccess(catalogUri, appContainerUri, owner, contact, mockFetch);

    const puts = mockFetch.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT");
    expect(puts).toHaveLength(0);
  });

  it("still attempts the app ACL when catalog ACL discovery fails", async () => {
    const mockFetch = makeFetch({
      [`HEAD ${catalogUri}`]: { status: 403 },
      [`HEAD ${appContainerUri}`]: { status: 200, headers: { Link: `<${appAclUri}>; rel="acl"` } },
      [appAclUri]: { status: 200, body: buildListOnlyAclTurtle(appContainerUri, owner, []) },
      [`PUT ${appAclUri}`]: { status: 201 },
    });

    await ensureDiscoveryAccess(catalogUri, appContainerUri, owner, contact, mockFetch);

    const puts = mockFetch.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT");
    expect(puts.map((call) => call[0])).toEqual([appAclUri]);
  });

  it("does not throw when both discovery writes fail", async () => {
    const mockFetch = makeFetch({
      [`HEAD ${catalogUri}`]: { status: 403 },
      [`HEAD ${appContainerUri}`]: { status: 403 },
    });

    await expect(
      ensureDiscoveryAccess(catalogUri, appContainerUri, owner, contact, mockFetch)
    ).resolves.toBeUndefined();
  });
});
