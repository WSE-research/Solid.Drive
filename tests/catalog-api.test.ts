import { describe, it, expect, vi } from "vitest";
import {
  resolveClass,
  ensureTBox,
  appendToCatalog,
  removeFromCatalog,
  linkCatalogToProfile,
} from "../src/catalog";

// Test helpers
type FetchCall = {
  url: string;
  method: string;
  body?: string;
  contentType?: string;
};

// Builds a mock fetch function that records every request.
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
    const res = responses[callIndex++] ?? { status: 200, ok: true };
    return {
      ok: res.ok ?? res.status < 400,
      status: res.status,
      statusText: res.statusText ?? (res.status < 400 ? "OK" : "Error"),
    } as Response;
  });

  return { fetch, calls };
}

// Verifies that MIME types are mapped to the expected semantic file classes.
describe("resolveClass", () => {
  it("maps image MIME types to ImageFile", () => {
    expect(resolveClass("image/jpeg")).toBe("https://w3id.org/solid-drive#ImageFile");
    expect(resolveClass("image/png")).toBe("https://w3id.org/solid-drive#ImageFile");
    expect(resolveClass("image/gif")).toBe("https://w3id.org/solid-drive#ImageFile");
  });

  it("maps video MIME types to VideoFile", () => {
    expect(resolveClass("video/mp4")).toBe("https://w3id.org/solid-drive#VideoFile");
    expect(resolveClass("video/webm")).toBe("https://w3id.org/solid-drive#VideoFile");
  });

  it("maps audio MIME types to AudioFile", () => {
    expect(resolveClass("audio/mpeg")).toBe("https://w3id.org/solid-drive#AudioFile");
    expect(resolveClass("audio/wav")).toBe("https://w3id.org/solid-drive#AudioFile");
  });

  it("maps text/* MIME types to TextDocument", () => {
    expect(resolveClass("text/plain")).toBe("https://w3id.org/solid-drive#TextDocument");
    expect(resolveClass("text/html")).toBe("https://w3id.org/solid-drive#TextDocument");
    expect(resolveClass("text/csv")).toBe("https://w3id.org/solid-drive#TextDocument");
  });

  it("maps office document MIME types to TextDocument", () => {
    expect(resolveClass("application/pdf")).toBe("https://w3id.org/solid-drive#TextDocument");
    expect(resolveClass("application/msword")).toBe("https://w3id.org/solid-drive#TextDocument");
    expect(resolveClass("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
      .toBe("https://w3id.org/solid-drive#TextDocument");
  });

  it("falls back to schema:DigitalDocument for unknown MIME types", () => {
    expect(resolveClass("application/zip")).toBe("http://schema.org/DigitalDocument");
    expect(resolveClass("application/octet-stream")).toBe("http://schema.org/DigitalDocument");
    expect(resolveClass("")).toBe("http://schema.org/DigitalDocument");
  });
});

/*
 * Verifies that the ontology file is created only when missing, and that the
 * generated Turtle contains the expected classes, properties, and constraints.
 */

describe("ensureTBox", () => {
  it("does not PUT when tbox.ttl already exists (HEAD 200)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await ensureTBox("https://pod.example/", fetch);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("HEAD");
    expect(calls[0].url).toBe("https://pod.example/tbox.ttl");
  });

  it("PUTs tbox.ttl with Content-Type text/turtle when it does not exist", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
    ]);

    await ensureTBox("https://pod.example/", fetch);

    expect(calls).toHaveLength(2);
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].url).toBe("https://pod.example/tbox.ttl");
    expect(calls[1].contentType).toBe("text/turtle");
  });

  it("PUT body contains rdfs:Class definitions for all file type subclasses", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
    ]);

    await ensureTBox("https://pod.example/", fetch);

    const body = calls[1].body ?? "";
    expect(body).toContain("rdfs:Class");
    expect(body).toContain("rdfs:subClassOf");
    expect(body).toContain("sd:ImageFile");
    expect(body).toContain("sd:VideoFile");
    expect(body).toContain("sd:AudioFile");
    expect(body).toContain("sd:TextDocument");
  });

  it("PUT body declares properties with rdfs:domain and rdfs:range", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
    ]);

    await ensureTBox("https://pod.example/", fetch);

    const body = calls[1].body ?? "";
    expect(body).toContain("rdfs:domain");
    expect(body).toContain("rdfs:range");
    expect(body).toContain("schema:name");
    expect(body).toContain("schema:uploadDate");
    expect(body).toContain("schema:publisher");
  });

  it("PUT body includes owl:Restriction cardinality constraints on required properties", async () => {
    const { fetch, calls } = capturingMock([
      { status: 404, ok: false },
      { status: 201, ok: true },
    ]);

    await ensureTBox("https://pod.example/", fetch);

    const body = calls[1].body ?? "";
    expect(body).toContain("owl:Restriction");
    expect(body).toContain("owl:minCardinality");
    expect(body).toContain("owl:onProperty");
  });

  it("throws when PUT fails", async () => {
    const { fetch } = capturingMock([
      { status: 404, ok: false },
      { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);

    await expect(ensureTBox("https://pod.example/", fetch)).rejects.toThrow(
      "Failed to write tbox.ttl"
    );
  });
});

// Verifies catalog creation and dataset insertion logic for uploaded resources.
describe("appendToCatalog", () => {
  const storageRoot = "https://pod.example/";
  const catalogUri = "https://pod.example/catalog.ttl";
  const instanceUri = "https://pod.example/my-app/photo/index.ttl";
  const binaryUri = "https://pod.example/my-app/photo/photo.jpg";
  const classUri = "https://w3id.org/solid-drive#ImageFile";
  const publisherWebId = "https://pod.example/profile/card#me";
  const modified = "2026-03-16T00:00:00.000Z";

  async function runAppend(
    overrides: Partial<{
      description: string;
      responses: Array<{ status: number; ok?: boolean; statusText?: string }>;
    }> = {}
  ) {
    const responses = overrides.responses ?? [
      { status: 200, ok: true }, // HEAD
      { status: 200, ok: true }, // PATCH
    ];
    const { fetch, calls } = capturingMock(responses);
    await appendToCatalog(
      storageRoot,
      instanceUri,
      binaryUri,
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
      storageRoot, instanceUri, binaryUri, classUri,
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
      storageRoot, instanceUri, binaryUri, classUri,
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

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain(`dcat:dataset <${instanceUri}>`);
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

  it("SPARQL INSERT declares dcat:Distribution with accessURL and mediaType", async () => {
    const { calls } = await runAppend();

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain("dcat:Distribution");
    expect(sparql).toContain(`dcat:accessURL <${binaryUri}>`);
    expect(sparql).toContain('dcat:mediaType "image/jpeg"');
    expect(sparql).toContain("dcat:byteSize 4500000");
  });

  it("distribution is linked from the dataset via dcat:distribution", async () => {
    const { calls } = await runAppend();

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain(`dcat:distribution <${instanceUri}#dist>`);
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
      appendToCatalog(storageRoot, instanceUri, binaryUri, classUri,
        "image/jpeg", 100, "x", "", modified, publisherWebId, fetch)
    ).rejects.toThrow("Failed to create catalog.ttl");
  });

  it("throws when PATCH update fails", async () => {
    const { fetch } = capturingMock([
      { status: 200, ok: true },
      { status: 500, ok: false, statusText: "Internal Server Error" },
    ]);

    await expect(
      appendToCatalog(storageRoot, instanceUri, binaryUri, classUri,
        "image/jpeg", 100, "x", "", modified, publisherWebId, fetch)
    ).rejects.toThrow("Failed to update catalog.ttl");
  });

  it("escapes double quotes in title so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      storageRoot, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, 'Q1 "Draft"', "", modified, publisherWebId, fetch
    );

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain('dcterms:title "Q1 \\"Draft\\""');
  });

  it("escapes backslashes in description so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      storageRoot, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "Path: C:\\Users\\me", modified, publisherWebId, fetch
    );

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain('dcterms:description "Path: C:\\\\Users\\\\me"');
  });

  it("escapes newlines in description so the SPARQL is not malformed", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await appendToCatalog(
      storageRoot, instanceUri, binaryUri, classUri,
      "image/jpeg", 100, "Photo", "line one\nline two", modified, publisherWebId, fetch
    );

    const sparql = calls[1].body ?? "";
    expect(sparql).toContain('dcterms:description "line one\\nline two"');
  });
});

// Verifies that the catalog rolls back cleanly (no orphaned resource)
describe("removeFromCatalog", () => {
  const storageRoot = "https://pod.example/";
  const instanceUri = "https://pod.example/my-app/photo/index.ttl";

  it("does nothing when catalog.ttl does not exist", async () => {
    const { fetch, calls } = capturingMock([{ status: 404, ok: false }]);

    await removeFromCatalog(storageRoot, instanceUri, fetch);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("HEAD");
  });

  it("sends PATCH with DELETE WHERE when catalog exists", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true }, 
      { status: 200, ok: true }, 
    ]);

    await removeFromCatalog(storageRoot, instanceUri, fetch);

    expect(calls[1].method).toBe("PATCH");
    expect(calls[1].url).toBe("https://pod.example/catalog.ttl");
    expect(calls[1].contentType).toBe("application/sparql-update");
  });

  it("DELETE WHERE removes both the dataset triples and the distribution triples", async () => {
    const { fetch, calls } = capturingMock([
      { status: 200, ok: true },
      { status: 200, ok: true },
    ]);

    await removeFromCatalog(storageRoot, instanceUri, fetch);

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

    await expect(removeFromCatalog(storageRoot, instanceUri, fetch)).rejects.toThrow(
      "Failed to remove entry from catalog.ttl"
    );
  });
});

// Verifies that the catalog is linked from user's WebID profile for external discoverability
describe("linkCatalogToProfile", () => {
  const storageRoot = "https://pod.example/";
  const webId = "https://pod.example/profile/card#me";

  it("PATCHes the profile document (fragment stripped from WebID)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(storageRoot, webId, fetch);

    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe("https://pod.example/profile/card");
  });

  it("PATCH uses application/sparql-update content type", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(storageRoot, webId, fetch);

    expect(calls[0].contentType).toBe("application/sparql-update");
  });

  it("INSERT body contains dcat:catalog pointing to catalog.ttl", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(storageRoot, webId, fetch);

    const sparql = calls[0].body ?? "";
    expect(sparql).toContain("dcat:catalog");
    expect(sparql).toContain("https://pod.example/catalog.ttl");
  });

  it("INSERT uses INSERT DATA (not DELETE)", async () => {
    const { fetch, calls } = capturingMock([{ status: 200, ok: true }]);

    await linkCatalogToProfile(storageRoot, webId, fetch);

    expect(calls[0].body).toContain("INSERT DATA");
    expect(calls[0].body).not.toContain("DELETE");
  });

  it("throws when PATCH fails", async () => {
    const { fetch } = capturingMock([{ status: 403, ok: false, statusText: "Forbidden" }]);

    await expect(linkCatalogToProfile(storageRoot, webId, fetch)).rejects.toThrow(
      "Failed to link catalog to profile"
    );
  });
});
