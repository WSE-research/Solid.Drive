
import { describe, it, expect, vi } from "vitest";
import { discoverAclUri, readAclAgents, buildAclTurtle, writeAcl } from "../src/fileAccess";

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
    expect(turtle).toContain("acl:mode acl:Read, acl:Write, acl:Control");
    expect(turtle).toContain("<https://owner.example/#me>");
  });

  it("includes each agent with Read only", () => {
    const turtle = buildAclTurtle("https://pod.example/file/", "https://owner.example/#me", ["https://alice.example/#me"]);
    expect(turtle).toContain("<https://alice.example/#me>");
    expect(turtle).toContain("acl:mode acl:Read .");
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
