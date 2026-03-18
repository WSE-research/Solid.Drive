import { describe, it, expect, vi } from "vitest";
import { resolveClass, appendToCatalog, removeFromCatalog, linkCatalogToProfile, } from "../../src/podCatalog";

type FetchCall = {
  url: string;
  method: string;
  body?: string;
  contentType?: string;
};

function capturingMock(
  responses: Array<{ status: number; ok?: boolean; statusText?: string }>
) {
  const calls: FetchCall[] = [];
  let callIndex = 0;

  const fetch = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      contentType: headers?.["Content-Type"],
    });
    const response = responses[callIndex++] ?? { status: 200, ok: true };
    return {
      ok: response.ok ?? response.status < 400,
      status: response.status,
      statusText: response.statusText ?? (response.status < 400 ? "OK" : "Error"),
    } as Response;
  });

  return { fetch, calls };
}

describe("resolveClass", () => {
  it("maps image MIME types to schema:ImageObject", () => {
    expect(resolveClass("image/jpeg")).toBe("http://schema.org/ImageObject");
    expect(resolveClass("image/png")).toBe("http://schema.org/ImageObject");
    expect(resolveClass("image/gif")).toBe("http://schema.org/ImageObject");
    expect(resolveClass("image/webp")).toBe("http://schema.org/ImageObject");
  });

  it("maps video MIME types to schema:VideoObject", () => {
    expect(resolveClass("video/mp4")).toBe("http://schema.org/VideoObject");
    expect(resolveClass("video/webm")).toBe("http://schema.org/VideoObject");
    expect(resolveClass("video/ogg")).toBe("http://schema.org/VideoObject");
  });

  it("maps audio MIME types to schema:AudioObject", () => {
    expect(resolveClass("audio/mpeg")).toBe("http://schema.org/AudioObject");
    expect(resolveClass("audio/wav")).toBe("http://schema.org/AudioObject");
    expect(resolveClass("audio/ogg")).toBe("http://schema.org/AudioObject");
  });

  it("maps text/* MIME types to schema:TextDigitalDocument", () => {
    expect(resolveClass("text/plain")).toBe("http://schema.org/TextDigitalDocument");
    expect(resolveClass("text/html")).toBe("http://schema.org/TextDigitalDocument");
  });

  it("maps PDF and Word document MIME types to schema:TextDigitalDocument", () => {
    expect(resolveClass("application/pdf")).toBe("http://schema.org/TextDigitalDocument");
    expect(resolveClass("application/msword")).toBe("http://schema.org/TextDigitalDocument");
    expect(resolveClass("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
      .toBe("http://schema.org/TextDigitalDocument");
    expect(resolveClass("application/rtf")).toBe("http://schema.org/TextDigitalDocument");
  });

  it("maps spreadsheet MIME types to schema:SpreadsheetDigitalDocument", () => {
    expect(resolveClass("text/csv")).toBe("http://schema.org/SpreadsheetDigitalDocument");
    expect(resolveClass("application/vnd.ms-excel")).toBe("http://schema.org/SpreadsheetDigitalDocument");
    expect(resolveClass("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      .toBe("http://schema.org/SpreadsheetDigitalDocument");
  });

  it("falls back to schema:DigitalDocument for unknown MIME types", () => {
    expect(resolveClass("application/zip")).toBe("http://schema.org/DigitalDocument");
    expect(resolveClass("application/octet-stream")).toBe("http://schema.org/DigitalDocument");
    expect(resolveClass("")).toBe("http://schema.org/DigitalDocument");
  });
});


describe("appendToCatalog", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const instanceUri = "https://pod.example/my-app/photo/index.ttl";
  const binaryUri = "https://pod.example/my-app/photo/photo.jpg";
  const classUri = "http://schema.org/ImageObject";
  const publisherWebId = "https://pod.example/profile/card#me";
  const modified = "2026-03-16T00:00:00.000Z";

  async function runAppend(
    overrides: Partial<{
      description: string;
      responses: Array<{ status: number; ok?: boolean; statusText?: string }>;
    }> = {}
  ) {
    const responses = overrides.responses ?? [
      { status: 200, ok: true },
      { status: 200, ok: true },
    ];
    const { fetch, calls } = capturingMock(responses);
    await appendToCatalog(
      catalogUri,
      instanceUri,
      classUri,
      "image/jpeg",
      4_500_000,
      "Summer Photo",
      overrides.description ?? "",
      modified,
      publisherWebId,
      fetch
    );
    return { calls };
  }

  it("creates catalog.ttl via PUT when it does not exist, then PATCHes", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "", modified, publisherWebId, fetch
    );

    expect(calls[0].method).toBe("HEAD");
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].url).toBe(catalogUri);
    expect(calls[2].method).toBe("PATCH");
  });

  it("PUT body for new catalog declares dcat:Catalog", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "", modified, publisherWebId, fetch
    );

    expect(calls[1].body).toContain("dcat:Catalog");
  });

  it("skips PUT when catalog.ttl already exists", async () => {
    const { calls } = await runAppend();

    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("HEAD");
    expect(calls[1].method).toBe("PATCH");
  });

  it("PATCH is sent to catalog.ttl with application/sparql-update", async () => {
    const { calls } = await runAppend();

    expect(calls[1].url).toBe(catalogUri);
    expect(calls[1].contentType).toBe("application/sparql-update");
  });

  it("SPARQL INSERT links dataset URI to catalog resource", async () => {
    const { calls } = await runAppend();

    expect(calls[1].body).toContain(`dcat:dataset <${instanceUri}>`);
  });

  it("SPARQL INSERT types the entry as dcat:Dataset", async () => {
    const { calls } = await runAppend();

    expect(calls[1].body).toContain("dcat:Dataset");
  });

  it("SPARQL INSERT includes dcterms:title, dcterms:publisher, dcterms:conformsTo", async () => {
    const { calls } = await runAppend();

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain('dcterms:title "Summer Photo"');
    expect(sparql).toContain(`dcterms:publisher <${publisherWebId}>`);
    expect(sparql).toContain(`dcterms:conformsTo <${classUri}>`);
  });

  it("dcterms:conformsTo references the schema.org class URI resolved from MIME type", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      catalogUri, instanceUri, binaryUri,
      "http://schema.org/TextDigitalDocument",
      "application/pdf", 512000, "Report", "", modified, publisherWebId, fetch
    );

    expect(calls[1].body).toContain("dcterms:conformsTo <http://schema.org/TextDigitalDocument>");
  });

  it("SPARQL INSERT declares dcat:Distribution with accessURL and mediaType", async () => {
    const { calls } = await runAppend();

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain("dcat:Distribution");
    expect(sparql).toContain('dcat:mediaType "image/jpeg"');
    expect(sparql).toContain("dcat:byteSize 4500000");
  });

  it("distribution is linked from the dataset via dcat:distribution", async () => {
    const { calls } = await runAppend();

    expect(calls[1].body).toContain(`dcat:distribution <${instanceUri}#dist>`);
  });

  it("includes dcterms:description when description is provided", async () => {
    const { calls } = await runAppend({ description: "A sunny day photo" });

    expect(calls[1].body).toContain('dcterms:description "A sunny day photo"');
  });

  it("omits dcterms:description when description is empty", async () => {
    const { calls } = await runAppend({ description: "" });

    expect(calls[1].body).not.toContain("dcterms:description");
  });

  it("throws when catalog PUT creation fails", async () => {
    const { fetch } = capturingMock([
      { status: 404, ok: false },
      { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);

    await expect(
      appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
        "image/jpeg", 100, "x", "", modified, publisherWebId, fetch)
    ).rejects.toThrow("Failed to create catalog.ttl");
  });

  it("throws when PATCH update fails", async () => {
    const { fetch } = capturingMock([
      { status: 200, ok: true },
      { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);

    await expect(
      appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
        "image/jpeg", 100, "x", "", modified, publisherWebId, fetch)
    ).rejects.toThrow("Failed to update catalog.ttl");
  });

  it("escapes double quotes in title so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, 'Q1 "Draft"', "", modified, publisherWebId, fetch
    );

    expect(calls[1].body).toContain('dcterms:title "Q1 \\"Draft\\""');
  });

  it("escapes backslashes in description so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "Path: C:\\Users\\me", modified, publisherWebId, fetch
    );

    expect(calls[1].body).toContain('dcterms:description "Path: C:\\\\Users\\\\me"');
  });

  it("escapes newlines in description so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "line one\nline two", modified, publisherWebId, fetch
    );

    expect(calls[1].body).toContain('dcterms:description "line one\\nline two"');
  });
});

describe("removeFromCatalog", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const instanceUri = "https://pod.example/my-app/photo/index.ttl";

  it("does nothing when catalog.ttl does not exist", async () => {
    const { fetch, calls } = capturingMock([{ status: 404, ok: false }]);

    await removeFromCatalog(catalogUri, instanceUri, fetch);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("HEAD");
  });

  it("sends PATCH with DELETE WHERE when catalog exists", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await removeFromCatalog(catalogUri, instanceUri, fetch);

    expect(calls[1].method).toBe("PATCH");
    expect(calls[1].url).toBe("https://pod.example/catalog.ttl");
    expect(calls[1].contentType).toBe("application/sparql-update");
  });

  it("DELETE WHERE removes both the dataset triples and the distribution triples", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await removeFromCatalog(catalogUri, instanceUri, fetch);

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain("DELETE WHERE");
    expect(sparql).toContain(`<${instanceUri}>`);
    expect(sparql).toContain(`<${instanceUri}#dist>`);
  });

  it("throws when PATCH fails", async () => {
    const { fetch } = capturingMock([
      { status: 200, ok: true },
      { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);

    await expect(removeFromCatalog(catalogUri, instanceUri, fetch)).rejects.toThrow(
      "Failed to remove entry from catalog.ttl"
    );
  });
});


describe("linkCatalogToProfile", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const webId = "https://pod.example/profile/card#me";

  it("PATCHes the profile document (fragment stripped from WebID)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(catalogUri, webId, fetch);

    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe("https://pod.example/profile/card");
  });

  it("PATCH uses text/n3 content type", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(catalogUri, webId, fetch);

    expect(calls[0].contentType).toBe("text/n3");
  });

  it("patch body contains dcat:catalog pointing to catalog.ttl", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(catalogUri, webId, fetch);

    const body = calls[0].body ?? "";
    expect(body).toContain("dcat:catalog");
    expect(body).toContain("https://pod.example/catalog.ttl");
  });

  it("patch uses solid:InsertDeletePatch with solid:inserts (no deletes)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(catalogUri, webId, fetch);

    const body = calls[0].body ?? "";
    expect(body).toContain("solid:InsertDeletePatch");
    expect(body).toContain("solid:inserts");
    expect(body).not.toContain("solid:deletes");
  });

  it("throws when PATCH fails", async () => {
    const { fetch } = capturingMock([{ status: 403, ok: false, statusText: "Forbidden" }]);

    await expect(linkCatalogToProfile(catalogUri, webId, fetch)).rejects.toThrow(
      "Failed to link catalog to profile"
    );
  });
});
