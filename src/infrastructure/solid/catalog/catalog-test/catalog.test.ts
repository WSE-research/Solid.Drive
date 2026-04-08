import { describe, it, expect, vi } from "vitest";
import { appendToCatalog, removeFromCatalog, linkCatalogToProfile, parseCatalog, resolveCatalogUri } from '../catalog-file/catalog';
import { getFileTypeLabel } from "@/infrastructure/validation/fileTypeRegistry";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";

// ─── Helpers ───────────────────────────────────────────────────────────────

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

  const mockFetch = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
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

  return { fetch: mockFetch, calls };
}

// ─── appendToCatalog ───────────────────────────────────────────────────────

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
    const responses = overrides.responses ?? [{ status: 200, ok: true }];
    const { fetch, calls } = capturingMock(responses);
    await appendToCatalog(
      catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 4_500_000, "Summer Photo",
      overrides.description ?? "", modified, publisherWebId, fetch
    );
    return { calls };
  }

  it("creates catalog.ttl via PUT when it does not exist, then PATCHes", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
      { status: 200, ok: true },
    ]);
    await appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "", modified, publisherWebId, fetch);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].url).toBe(catalogUri);
    expect(calls[2].method).toBe("PATCH");
  });

  it("PUT body for new catalog declares dcat:Catalog", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false }, { status: 201, ok: true }, { status: 200, ok: true },
    ]);
    await appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "", modified, publisherWebId, fetch);
    expect(calls[1].body).toContain("dcat:Catalog");
  });

  it("skips PUT when catalog.ttl already exists", async () => {
    const { calls } = await runAppend();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PATCH");
  });

  it("PATCH is sent to catalog.ttl with application/sparql-update", async () => {
    const { calls } = await runAppend();
    expect(calls[0].url).toBe(catalogUri);
    expect(calls[0].contentType).toBe("application/sparql-update");
  });

  it("SPARQL INSERT links dataset URI to catalog resource", async () => {
    const { calls } = await runAppend();
    expect(calls[0].body).toContain(`dcat:dataset <${instanceUri}>`);
  });

  it("SPARQL INSERT types the entry as dcat:Dataset", async () => {
    const { calls } = await runAppend();
    expect(calls[0].body).toContain("dcat:Dataset");
  });

  it("SPARQL INSERT includes dcterms:title, dcterms:publisher, dcterms:conformsTo", async () => {
    const { calls } = await runAppend();
    const sparql = calls[0].body ?? "";
    expect(sparql).toContain('dcterms:title "Summer Photo"');
    expect(sparql).toContain(`dcterms:publisher <${publisherWebId}>`);
    expect(sparql).toContain(`dcterms:conformsTo <${classUri}>`);
  });

  it("dcterms:conformsTo references the schema.org class URI resolved from MIME type", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await appendToCatalog(catalogUri, instanceUri, binaryUri,
      "http://schema.org/TextDigitalDocument",
      "application/pdf", 512000, "Report", "", modified, publisherWebId, fetch);
    expect(calls[0].body).toContain("dcterms:conformsTo <http://schema.org/TextDigitalDocument>");
  });

  it("SPARQL INSERT declares dcat:Distribution with accessURL and mediaType", async () => {
    const { calls } = await runAppend();
    const sparql = calls[0].body ?? "";
    expect(sparql).toContain("dcat:Distribution");
    expect(sparql).toContain(`dcat:accessURL <${binaryUri}>`);
    expect(sparql).toContain('dcat:mediaType "image/jpeg"');
    expect(sparql).toContain("dcat:byteSize 4500000");
  });

  it("distribution is linked from the dataset via dcat:distribution", async () => {
    const { calls } = await runAppend();
    expect(calls[0].body).toContain(`dcat:distribution <${instanceUri}#dist>`);
  });

  it("includes dcterms:description when description is provided", async () => {
    const { calls } = await runAppend({ description: "A sunny day photo" });
    expect(calls[0].body).toContain('dcterms:description "A sunny day photo"');
  });

  it("omits dcterms:description when description is empty", async () => {
    const { calls } = await runAppend({ description: "" });
    expect(calls[0].body).not.toContain("dcterms:description");
  });

  it("throws when catalog PUT creation fails", async () => {
    const { fetch } = capturingMock([
      { status: 404, ok: false }, { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);
    await expect(appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "x", "", modified, publisherWebId, fetch))
      .rejects.toThrow("Failed to create catalog.ttl");
  });

  it("throws when PATCH update fails", async () => {
    const { fetch } = capturingMock([{ status: 500, ok: false, statusText: "Internal Server Error" }]);
    await expect(appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "x", "", modified, publisherWebId, fetch))
      .rejects.toThrow("Failed to update catalog.ttl");
  });

  it("escapes double quotes in title so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, 'Q1 "Draft"', "", modified, publisherWebId, fetch);
    expect(calls[0].body).toContain('dcterms:title "Q1 \\"Draft\\""');
  });

  it("escapes backslashes in description so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "Path: C:\\Users\\me", modified, publisherWebId, fetch);
    expect(calls[0].body).toContain('dcterms:description "Path: C:\\\\Users\\\\me"');
  });

  it("escapes newlines in description so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await appendToCatalog(catalogUri, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "line one\nline two", modified, publisherWebId, fetch);
    expect(calls[0].body).toContain('dcterms:description "line one\\nline two"');
  });
});

// ─── removeFromCatalog ─────────────────────────────────────────────────────

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
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }, { status: 200, ok: true }]);
    await removeFromCatalog(catalogUri, instanceUri, fetch);
    expect(calls[1].method).toBe("PATCH");
    expect(calls[1].url).toBe("https://pod.example/catalog.ttl");
    expect(calls[1].contentType).toBe("application/sparql-update");
  });

  it("DELETE WHERE removes both the dataset triples and the distribution triples", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }, { status: 200, ok: true }]);
    await removeFromCatalog(catalogUri, instanceUri, fetch);
    const sparql = calls[1].body ?? "";
    expect(sparql).toContain("DELETE WHERE");
    expect(sparql).toContain(`<${instanceUri}>`);
    expect(sparql).toContain(`<${instanceUri}#dist>`);
  });

  it("throws when PATCH fails", async () => {
    const { fetch } = capturingMock([
      { status: 200, ok: true }, { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);
    await expect(removeFromCatalog(catalogUri, instanceUri, fetch))
      .rejects.toThrow("Failed to remove entry from catalog.ttl");
  });
});

// ─── linkCatalogToProfile ──────────────────────────────────────────────────

describe("linkCatalogToProfile", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const webId = "https://pod.example/profile/card#me";

  it("PATCHes the profile document (fragment stripped from WebID)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await linkCatalogToProfile(catalogUri, webId, fetch);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe("https://pod.example/profile/card");
  });

  it("PATCH uses application/sparql-update content type", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await linkCatalogToProfile(catalogUri, webId, fetch);
    expect(calls[0].contentType).toBe("application/sparql-update");
  });

  it("INSERT body contains dcat:catalog pointing to catalog.ttl", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await linkCatalogToProfile(catalogUri, webId, fetch);
    const body = calls[0].body ?? "";
    expect(body).toContain("dcat:catalog");
    expect(body).toContain("https://pod.example/catalog.ttl");
  });

  it("INSERT uses INSERT DATA (not DELETE)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);
    await linkCatalogToProfile(catalogUri, webId, fetch);
    expect(calls[0].body).toContain("INSERT DATA");
    expect(calls[0].body).not.toContain("DELETE");
  });

  it("throws when PATCH fails", async () => {
    const { fetch } = capturingMock([{ status: 403, ok: false, statusText: "Forbidden" }]);
    await expect(linkCatalogToProfile(catalogUri, webId, fetch))
      .rejects.toThrow("Failed to link catalog to profile");
  });
});

// ─── parseCatalog ──────────────────────────────────────────────────────────

describe("parseCatalog", () => {
  it("returns empty array for an empty catalog", () => {
    const turtle = `
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <> a dcat:Catalog .
    `;
    expect(parseCatalog(turtle)).toEqual([]);
  });

  it("returns empty array for invalid turtle that causes a parse error", () => {
    const invalidTurtle = "this is not valid turtle {{{ <<< >>>";
    expect(parseCatalog(invalidTurtle)).toEqual([]);
  });

  it("parses a single entry with a Distribution node", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/photo-jpg/index.ttl";
    const binaryUri = "https://pod.example/my-app/photo-jpg/photo.jpg";

    const turtle = `
    @prefix dcat:    <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    @prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

    <> a dcat:Catalog .
    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset ;
      dcterms:conformsTo <http://schema.org/ImageObject> ;
      dcterms:title "Summer photo" ;
      dcterms:modified "2026-03-16T11:52:13.066Z"^^xsd:dateTime ;
      dcterms:publisher <https://pod.example/profile/card#me> ;
      dcat:distribution <${instanceUri}#dist> .
    <${instanceUri}#dist> a dcat:Distribution ;
      dcat:accessURL <${binaryUri}> ;
      dcat:mediaType "image/jpeg" ;
      dcat:byteSize 4500000 .
    `.trim();

    const entries = parseCatalog(turtle);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      uri: instanceUri,
      conformsTo: "http://schema.org/ImageObject",
      title: "Summer photo",
      description: "",
      modified: "2026-03-16T11:52:13.066Z",
      publisher: "https://pod.example/profile/card#me",
      mediaType: "image/jpeg",
      byteSize: 4500000,
      accessURL: binaryUri,
    });
  });

  it("parses a document entry with schema:TextDigitalDocument", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/report/index.ttl";

    const turtle = `
    @prefix dcat:    <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    @prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset ;
      dcterms:conformsTo <http://schema.org/TextDigitalDocument> ;
      dcterms:title "Q1 Report" ;
      dcterms:description "Quarterly financial summary" ;
      dcterms:modified "2026-03-01T00:00:00.000Z"^^xsd:dateTime ;
      dcterms:publisher <https://pod.example/profile/card#me> ;
      dcat:distribution <${instanceUri}#dist> .
    <${instanceUri}#dist> a dcat:Distribution ;
      dcat:accessURL <https://pod.example/my-app/report/report.pdf> ;
      dcat:mediaType "application/pdf" ;
      dcat:byteSize 512000 .
    `.trim();

    const entries = parseCatalog(turtle);
    expect(entries[0].conformsTo).toBe("http://schema.org/TextDigitalDocument");
    expect(entries[0].description).toBe("Quarterly financial summary");
  });

  it("returns zero byteSize and empty strings gracefully for missing properties", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const instanceUri = "https://pod.example/my-app/file/index.ttl";
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset .
    `.trim();
    const entries = parseCatalog(turtle);
    expect(entries).toHaveLength(1);
    expect(entries[0].byteSize).toBe(0);
    expect(entries[0].mediaType).toBe("");
    expect(entries[0].conformsTo).toBe("");
    expect(entries[0].description).toBe("");
    expect(entries[0].accessURL).toBe("");
  });

  it("parses catalog with baseUri parameter (line 217 truthy branch)", () => {
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    <https://pod.example/my-app/catalog.ttl> dcat:dataset <https://pod.example/my-app/entry/index.ttl> .
    <https://pod.example/my-app/entry/index.ttl> a dcat:Dataset ;
       dcterms:title "Relative Entry" .
    `.trim();
    const entries = parseCatalog(turtle, "https://pod.example/my-app/catalog.ttl");
    expect(entries).toHaveLength(1);
    expect(entries[0].uri).toBe("https://pod.example/my-app/entry/index.ttl");
    expect(entries[0].title).toBe("Relative Entry");
  });
});

// ─── getFileTypeLabel ─────────────────────────────────────────────────────────

describe("getFileTypeLabel", () => {
  it("returns labels derived from TBox ontology for known schema.org URIs", () => {
    // Labels now come from the TBox TTL file (rdfs:label)
    // These are the default fallback labels when TBox isn't loaded
    expect(getFileTypeLabel("http://schema.org/ImageObject")).toBe("Image");
    expect(getFileTypeLabel("http://schema.org/VideoObject")).toBe("Video");
    expect(getFileTypeLabel("http://schema.org/AudioObject")).toBe("Audio");
    expect(getFileTypeLabel("http://schema.org/TextDigitalDocument")).toBe("Text digital document");
    expect(getFileTypeLabel("http://schema.org/SpreadsheetDigitalDocument")).toBe("Spreadsheet digital document");
    expect(getFileTypeLabel("http://schema.org/DigitalDocument")).toBe("Digital document");
  });

  it("returns the label when matched by id", () => {
    expect(getFileTypeLabel("ImageObject")).toBe("Image");
    expect(getFileTypeLabel("TextDigitalDocument")).toBe("Text digital document");
    expect(getFileTypeLabel("SpreadsheetDigitalDocument")).toBe("Spreadsheet digital document");
  });

  it("falls back to the local name for unknown URIs", () => {
    expect(getFileTypeLabel("https://example.com/ontology#CustomType")).toBe("CustomType");
  });

  it("falls back to the full string when no local name can be extracted", () => {
    expect(getFileTypeLabel("just-a-string")).toBe("just-a-string");
  });
});

// ─── resolveCatalogUri ─────────────────────────────────────────────────────

describe("resolveCatalogUri", () => {
  it("returns undefined when storageRoot is empty", () => {
    expect(resolveCatalogUri(undefined, "")).toBeUndefined();
  });

  it("returns undefined when storageRoot is undefined", () => {
    expect(resolveCatalogUri(undefined, undefined)).toBeUndefined();
  });

  it("falls back to storageRoot/catalog.ttl when profile has no catalog", () => {
    expect(resolveCatalogUri(undefined, "https://pod.example/"))
      .toBe("https://pod.example/catalog.ttl");
  });

  it("uses the catalog URI from the profile when present", () => {
    const profile = { catalog: { "@id": "https://pod.example/my-catalog.ttl" } } as SolidProfile;
    expect(resolveCatalogUri(profile, "https://pod.example/"))
      .toBe("https://pod.example/my-catalog.ttl");
  });

  it("falls back to storageRoot/catalog.ttl when profile catalog is null", () => {
    const profile = { catalog: null } as unknown as SolidProfile;
    expect(resolveCatalogUri(profile, "https://pod.example/"))
      .toBe("https://pod.example/catalog.ttl");
  });

  it("profile catalog takes precedence over storageRoot fallback", () => {
    const profile = { catalog: { "@id": "https://other.example/shared-catalog.ttl" } } as SolidProfile;
    expect(resolveCatalogUri(profile, "https://pod.example/"))
      .toBe("https://other.example/shared-catalog.ttl");
  });
});

// ─── assertSafeUri (via public API) ───────────────────────────────────────────

describe("assertSafeUri (via appendToCatalog)", () => {
  const base = {
    instanceUri: "https://pod.example/my-app/photo/index.ttl",
    binaryUri:   "https://pod.example/my-app/photo/photo.jpg",
    classUri:    "http://schema.org/ImageObject",
    publisher:   "https://pod.example/profile/card#me",
    modified:    "2026-03-16T00:00:00.000Z",
  };

  it("throws when catalogUri contains a '>' character", async () => {
    const { fetch } = capturingMock([]);
    await expect(
      appendToCatalog(
        "https://evil.example/><script>", base.instanceUri, base.binaryUri,
        base.classUri, "image/jpeg", 0, "x", "", base.modified, base.publisher, fetch
      )
    ).rejects.toThrow("Unsafe URI");
  });

  it("throws when instanceUri contains whitespace", async () => {
    const { fetch } = capturingMock([]);
    await expect(
      appendToCatalog(
        "https://pod.example/catalog.ttl", "https://pod.example/my app/index.ttl", base.binaryUri,
        base.classUri, "image/jpeg", 0, "x", "", base.modified, base.publisher, fetch
      )
    ).rejects.toThrow("Unsafe URI");
  });
});
