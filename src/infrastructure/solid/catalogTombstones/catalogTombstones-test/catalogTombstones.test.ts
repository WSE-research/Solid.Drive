import { describe, it, expect, vi } from "vitest";
import { appendTombstones, purgeExpiredTombstones, readTombstonedTags, resolveTombstoneLogUri } from "../catalogTombstones-file/catalogTombstones";

const catalogUri = "https://pod.example/my-app/catalog.ttl";
const tombstoneLogUri = "https://pod.example/my-app/catalog-tombstones.ttl";
const tagA = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const tagB = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

type FetchCall = { url: string; method: string; body?: string; contentType?: string };

/**
 * A fetch mock keyed by URL, so a test can answer GET and PATCH against
 * the tombstone log. A PUT (creating the log for the first time) always
 * succeeds, matching a server that accepts a plain write to a brand new
 * resource.
 */
function mockFetch(responses: Record<string, { status: number; body?: string }>) {
  const calls: FetchCall[] = [];
  const fetch = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method, body: typeof init?.body === "string" ? init.body : undefined, contentType: headers?.["Content-Type"] });

    if (method === "PUT") {
      return { ok: true, status: 201, statusText: "Created" } as Response;
    }
    const response = responses[String(url)] ?? { status: 404 };
    return {
      ok: response.status < 400,
      status: response.status,
      statusText: response.status < 400 ? "OK" : "Error",
      text: async () => response.body ?? "",
    } as Response;
  });
  return { fetch, calls };
}

describe("resolveTombstoneLogUri", () => {
  it("names the tombstone log as a sibling of the catalog", () => {
    expect(resolveTombstoneLogUri(catalogUri)).toBe(tombstoneLogUri);
  });

  it("stays a sibling for a catalog with a custom filename", () => {
    expect(resolveTombstoneLogUri("https://pod.example/my-app/my-catalog.ttl")).toBe(tombstoneLogUri);
  });
});

describe("readTombstonedTags", () => {
  it("returns no tombstones when the log doesn't exist yet", async () => {
    const { fetch } = mockFetch({ [tombstoneLogUri]: { status: 404 } });
    const tombstones = await readTombstonedTags(catalogUri, fetch);
    expect(tombstones.size).toBe(0);
  });

  it("reads back every tombstoned tag with its deletion time", async () => {
    const body = `
      @prefix as: <https://www.w3.org/ns/activitystreams#> .
      <urn:uuid:${tagA}> as:deleted "2026-01-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
      <urn:uuid:${tagB}> as:deleted "2026-02-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    `.trim();
    const { fetch } = mockFetch({ [tombstoneLogUri]: { status: 200, body } });

    const tombstones = await readTombstonedTags(catalogUri, fetch);
    expect(tombstones.get(tagA)).toBe("2026-01-01T00:00:00.000Z");
    expect(tombstones.get(tagB)).toBe("2026-02-01T00:00:00.000Z");
  });

  it("throws instead of treating a corrupt log as having no tombstones", async () => {
    const { fetch } = mockFetch({ [tombstoneLogUri]: { status: 200, body: "this is not valid turtle {{{ <<< >>>" } });
    await expect(readTombstonedTags(catalogUri, fetch)).rejects.toThrow(tombstoneLogUri);
  });

  it("throws when the log can't be read for a reason other than it not existing yet", async () => {
    const { fetch } = mockFetch({ [tombstoneLogUri]: { status: 500 } });
    await expect(readTombstonedTags(catalogUri, fetch)).rejects.toThrow(tombstoneLogUri);
  });
});

describe("appendTombstones", () => {
  it("does nothing when there are no tags to tombstone", async () => {
    const { fetch, calls } = mockFetch({});
    await appendTombstones(catalogUri, [], fetch);
    expect(calls).toHaveLength(0);
  });

  it("appends to the log with an N3 Patch when the log already exists", async () => {
    const { fetch, calls } = mockFetch({ [tombstoneLogUri]: { status: 200, body: "" } });
    await appendTombstones(catalogUri, [tagA], fetch, new Date("2026-03-01T00:00:00.000Z"));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: tombstoneLogUri, method: "PATCH", contentType: "text/n3" });
    expect(calls[0].body).toContain(`urn:uuid:${tagA}`);
    expect(calls[0].body).toContain("2026-03-01T00:00:00.000Z");
  });

  it("creates the log with a PUT when tombstoning for the first time", async () => {
    const { fetch, calls } = mockFetch({ [tombstoneLogUri]: { status: 404 } });
    await appendTombstones(catalogUri, [tagA, tagB], fetch, new Date("2026-03-01T00:00:00.000Z"));

    expect(calls.map((call) => call.method)).toEqual(["PATCH", "PUT"]);
    const putCall = calls[1];
    expect(putCall.contentType).toBe("text/turtle");
    expect(putCall.body).toContain(`urn:uuid:${tagA}`);
    expect(putCall.body).toContain(`urn:uuid:${tagB}`);
  });

  it("reads back a tag it just tombstoned", async () => {
    let stored = "";
    const fetch = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PATCH") return { ok: false, status: 404, statusText: "Not Found" } as Response;
      if (method === "PUT") {
        stored = init?.body as string;
        return { ok: true, status: 201, statusText: "Created" } as Response;
      }
      return stored
        ? ({ ok: true, status: 200, statusText: "OK", text: async () => stored } as Response)
        : ({ ok: false, status: 404, statusText: "Not Found" } as Response);
    });

    await appendTombstones(catalogUri, [tagA], fetch, new Date("2026-03-01T00:00:00.000Z"));
    const tombstones = await readTombstonedTags(catalogUri, fetch);
    expect(tombstones.has(tagA)).toBe(true);
  });

  it("rejects a tag that isn't shaped like a UUID", async () => {
    const { fetch } = mockFetch({ [tombstoneLogUri]: { status: 200, body: "" } });
    await expect(appendTombstones(catalogUri, ["not-a-uuid"], fetch)).rejects.toThrow("not-a-uuid");
  });

  it("throws when the server rejects the append for a reason other than a missing log", async () => {
    const { fetch } = mockFetch({ [tombstoneLogUri]: { status: 500 } });
    await expect(appendTombstones(catalogUri, [tagA], fetch)).rejects.toThrow(tombstoneLogUri);
  });
});

describe("purgeExpiredTombstones", () => {
  const oldTombstone = `
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    <urn:uuid:${tagA}> as:deleted "2026-01-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    <urn:uuid:${tagB}> as:deleted "2026-02-25T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
  `.trim();

  it("does nothing when the log has no tombstones past retention", async () => {
    const { fetch, calls } = mockFetch({ [tombstoneLogUri]: { status: 200, body: oldTombstone } });
    await purgeExpiredTombstones(catalogUri, fetch, 30, new Date("2026-01-10T00:00:00.000Z"));
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("deletes only the tombstones past retention, leaving the rest", async () => {
    const { fetch, calls } = mockFetch({ [tombstoneLogUri]: { status: 200, body: oldTombstone } });
    await purgeExpiredTombstones(catalogUri, fetch, 30, new Date("2026-03-05T00:00:00.000Z"));

    const patchCall = calls.find((call) => call.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(patchCall?.body).toContain(`urn:uuid:${tagA}`);
    expect(patchCall?.body).not.toContain(`urn:uuid:${tagB}`);
  });

  it("does nothing when the log doesn't exist", async () => {
    const { fetch, calls } = mockFetch({ [tombstoneLogUri]: { status: 404 } });
    await purgeExpiredTombstones(catalogUri, fetch, 30, new Date("2026-03-05T00:00:00.000Z"));
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("throws when the server rejects the purge patch", async () => {
    const fetch = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PATCH") return { ok: false, status: 500, statusText: "Error" } as Response;
      return { ok: true, status: 200, statusText: "OK", text: async () => oldTombstone } as Response;
    });
    await expect(purgeExpiredTombstones(catalogUri, fetch, 30, new Date("2026-03-05T00:00:00.000Z"))).rejects.toThrow(tombstoneLogUri);
  });
});
