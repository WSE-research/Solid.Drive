import { describe, it, expect, vi } from "vitest";
import { findCatalogEntry } from "../catalogLookup-file/catalogLookup";

const catalogUri = "https://pod.example/catalog.ttl";
const instanceUri = "https://pod.example/my-app/photo/index.ttl";

const turtle = `
  @prefix dcat: <http://www.w3.org/ns/dcat#> .
  @prefix dcterms: <http://purl.org/dc/terms/> .
  <${catalogUri}> dcat:dataset <${instanceUri}> .
  <${instanceUri}> a dcat:Dataset ; dcterms:title "Summer Photo" .
`.trim();

function mockFetch(response: { status: number; body?: string }) {
  return vi.fn(async () => ({
    ok: response.status < 400,
    status: response.status,
    text: async () => response.body ?? "",
  })) as unknown as typeof fetch;
}

describe("findCatalogEntry", () => {
  it("returns the entry whose uri matches, ignoring every other row", async () => {
    const fetch = mockFetch({ status: 200, body: turtle });
    const entry = await findCatalogEntry(catalogUri, instanceUri, fetch);
    expect(entry?.title).toBe("Summer Photo");
  });

  it("returns null when no entry has that uri", async () => {
    const fetch = mockFetch({ status: 200, body: turtle });
    const entry = await findCatalogEntry(catalogUri, "https://pod.example/my-app/other/index.ttl", fetch);
    expect(entry).toBeNull();
  });

  it("returns null when the catalog can't be read", async () => {
    const fetch = mockFetch({ status: 404 });
    const entry = await findCatalogEntry(catalogUri, instanceUri, fetch);
    expect(entry).toBeNull();
  });

  it("bypasses cached responses, so a document that changed since the last read is seen immediately", async () => {
    const fetch = mockFetch({ status: 200, body: turtle });
    await findCatalogEntry(catalogUri, instanceUri, fetch);
    expect(fetch).toHaveBeenCalledWith(catalogUri, expect.objectContaining({ cache: "no-store" }));
  });
});
