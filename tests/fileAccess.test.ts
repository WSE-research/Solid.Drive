
import { describe, it, expect, vi } from "vitest";
import { Parser } from "n3";
import { discoverAclUri, readAclAgents, buildAclTurtle, buildResourceAclTurtle, writeAcl, writeResourceAcl } from "../src/fileAccess";

const ACL_NS = "http://www.w3.org/ns/auth/acl#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

function parseAclTurtle(turtle: string, baseIRI = "https://pod.example/.acl") {
  return new Parser({ baseIRI }).parse(turtle);
}

function getModesForAgent(turtle: string, agentWebId: string, baseIRI?: string): string[] {
  const quads = parseAclTurtle(turtle, baseIRI);
  const authSubjects = new Set(
    quads
      .filter((q) => q.predicate.value === RDF_TYPE && q.object.value === `${ACL_NS}Authorization`)
      .map((q) => q.subject.value)
  );
  const modes: string[] = [];
  for (const subject of authSubjects) {
    const hasAgent = quads.some((q) => q.subject.value === subject && q.predicate.value === `${ACL_NS}agent` && q.object.value === agentWebId);
    if (!hasAgent) continue;
    quads
      .filter((q) => q.subject.value === subject && q.predicate.value === `${ACL_NS}mode`)
      .forEach((q) => modes.push(q.object.value));
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
  it("includes owner with Read Write Control", () => {
    const turtle = buildAclTurtle("https://pod.example/file/", "https://owner.example/#me", []);
    const ownerModes = getModesForAgent(turtle, "https://owner.example/#me");
    expect(ownerModes).toContain(`${ACL_NS}Read`);
    expect(ownerModes).toContain(`${ACL_NS}Write`);
    expect(ownerModes).toContain(`${ACL_NS}Control`);
  });

  it("includes each agent with Read only", () => {
    const turtle = buildAclTurtle("https://pod.example/file/", "https://owner.example/#me", ["https://alice.example/#me"]);
    const aliceModes = getModesForAgent(turtle, "https://alice.example/#me");
    expect(aliceModes).toContain(`${ACL_NS}Read`);
    expect(aliceModes).not.toContain(`${ACL_NS}Write`);
    expect(aliceModes).not.toContain(`${ACL_NS}Control`);
  });
});

describe("buildResourceAclTurtle", () => {
  it("does not include acl:default for leaf resources", () => {
    const turtle = buildResourceAclTurtle("https://pod.example/catalog.ttl", "https://owner.example/#me", ["https://alice.example/#me"]);
    const quads = parseAclTurtle(turtle);
    expect(quads.some((q) => q.predicate.value === `${ACL_NS}default`)).toBe(false);
    const aliceModes = getModesForAgent(turtle, "https://alice.example/#me");
    expect(aliceModes).toContain(`${ACL_NS}Read`);
  });
});

describe("writeAcl", () => {
  it("PUTs turtle to ACL URI with text/turtle content-type", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/file/.acl": { status: 201 } });
    await expect(
      writeAcl("https://pod.example/file/.acl", "https://pod.example/file/", "https://owner.example/#me", [], mockFetch)
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pod.example/file/.acl",
      expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Content-Type": "text/turtle" }) })
    );
  });

  it("throws when PUT fails", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/file/.acl": { status: 403 } });
    await expect(
      writeAcl("https://pod.example/file/.acl", "https://pod.example/file/", "https://owner.example/#me", [], mockFetch)
    ).rejects.toThrow("403");
  });
});

describe("writeResourceAcl", () => {
  it("PUTs turtle to ACL URI with text/turtle content-type", async () => {
    const mockFetch = makeFetch({ "PUT https://pod.example/catalog.ttl.acl": { status: 201 } });
    await expect(
      writeResourceAcl("https://pod.example/catalog.ttl.acl", "https://pod.example/catalog.ttl", "https://owner.example/#me", [], mockFetch)
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pod.example/catalog.ttl.acl",
      expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Content-Type": "text/turtle" }) })
    );
  });
});
