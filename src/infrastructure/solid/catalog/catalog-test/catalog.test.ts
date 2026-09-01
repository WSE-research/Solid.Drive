import { describe, it, expect, vi } from "vitest";
import {
  appendToCatalog,
  appendFolderToCatalog,
  ensureCatalogRootEntry,
  buildEmptyCatalogTurtle,
  isFolderEntry,
  FOLDER_CLASS_URI,
  FILE_CLASS_URI,
  LEGACY_FOLDER_CLASS_URI,
  removeFromCatalog,
  linkCatalogToProfile,
  parseCatalog,
  parseCatalogRecovering,
  resolveCatalogUri,
} from '../catalog-file/catalog';
import { getFileTypeLabel } from "@/infrastructure/validation/fileTypeRegistry";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";
import type { CatalogEntry } from "@/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

type FetchCall = {
  url: string;
  method: string;
  body?: string;
  contentType?: string;
};

/**
 * Mocks a GET/HEAD/PUT round-trip against a single resource: `getResponse`
 * answers every GET/HEAD, and every PUT succeeds unless `putStatus` says
 * otherwise. Callers read back `calls` to assert on what was sent.
 */
function capturingMock(getResponse: { status: number; body?: string }, putStatus = 200) {
  const calls: FetchCall[] = [];

  const mockFetch = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    const method = init?.method ?? "GET";
    calls.push({
      url: String(url),
      method,
      body: typeof init?.body === "string" ? init.body : undefined,
      contentType: headers?.["Content-Type"],
    });

    if (method === "PUT") {
      return { ok: putStatus < 400, status: putStatus, statusText: putStatus < 400 ? "OK" : "Error" } as Response;
    }
    return {
      ok: getResponse.status < 400,
      status: getResponse.status,
      statusText: getResponse.status < 400 ? "OK" : "Not Found",
      text: async () => getResponse.body ?? "",
    } as Response;
  });

  return { fetch: mockFetch, calls };
}

const putBody = (calls: FetchCall[]) => calls.find((call) => call.method === "PUT")?.body ?? "";

// ─── appendToCatalog ───────────────────────────────────────────────────────

describe("appendToCatalog", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const instanceUri = "https://pod.example/my-app/photo/index.ttl";
  const binaryUri = "https://pod.example/my-app/photo/photo.jpg";
  const classUri = "http://schema.org/ImageObject";
  const parentUri = "https://pod.example/my-app/";
  const publisherWebId = "https://pod.example/profile/card#me";
  const modified = "2026-03-16T00:00:00.000Z";

  async function runAppend(overrides: Partial<{ description: string; parentUri: string; getResponse: { status: number; body?: string } }> = {}) {
    const { fetch, calls } = capturingMock(overrides.getResponse ?? { status: 404 });
    await appendToCatalog({
      catalogUri, instanceUri, binaryUri, classUri,
      parentUri: overrides.parentUri ?? parentUri,
      mediaType: "image/jpeg", byteSize: 4_500_000, title: "Summer Photo",
      description: overrides.description ?? "", modified, publisherWebId, fetch,
    });
    return { calls };
  }

  it("reads the catalog, then PUTs the whole document back — a single GET/PUT round trip", async () => {
    const { calls } = await runAppend();
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(catalogUri);
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].url).toBe(catalogUri);
  });

  it("PUT uses text/turtle content type", async () => {
    const { calls } = await runAppend();
    expect(calls[1].contentType).toBe("text/turtle");
  });

  it("starts from an empty document when the catalog does not exist yet (GET 404)", async () => {
    const { calls } = await runAppend({ getResponse: { status: 404 } });
    expect(putBody(calls)).toContain(`<${instanceUri}>`);
  });

  it("declares the catalog itself as a dcat:Catalog when creating it for the first time", async () => {
    const { calls } = await runAppend({ getResponse: { status: 404 } });
    expect(putBody(calls)).toMatch(new RegExp(`<${catalogUri}>\\s+a\\s+dcat:Catalog`));
  });

  it("does not re-declare dcat:Catalog when appending to an existing catalog", async () => {
    const existingTurtle = `
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <${catalogUri}> a dcat:Catalog .
    `.trim();
    const { calls } = await runAppend({ getResponse: { status: 200, body: existingTurtle } });
    expect(putBody(calls).match(/a\s+dcat:Catalog/g)).toHaveLength(1);
  });

  it("preserves an existing entry in the catalog when appending a new one", async () => {
    const existingUri = "https://pod.example/my-app/other/index.ttl";
    const existingTurtle = `
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      <${catalogUri}> dcat:dataset <${existingUri}> .
      <${existingUri}> a dcat:Dataset ; dcterms:title "Existing File" .
    `.trim();
    const { calls } = await runAppend({ getResponse: { status: 200, body: existingTurtle } });

    const entries = parseCatalog(putBody(calls), catalogUri);
    expect(entries.map((entry) => entry.title).sort()).toEqual(["Existing File", "Summer Photo"]);
  });

  it("marks the new entry as a file, not just a generic catalog dataset", async () => {
    const { calls } = await runAppend();
    expect(putBody(calls)).toContain(`<${instanceUri}> a dcat:Dataset, <${FILE_CLASS_URI}>`);
  });

  it("links the entry to its folder via sd:hasParent, readable back from the written document", async () => {
    const { calls } = await runAppend();
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.parentUri).toBe(parentUri);
  });

  it("leaves out the parent-folder link when no parent is given", async () => {
    const { calls } = await runAppend({ parentUri: "" });
    expect(putBody(calls)).not.toContain("hasParent");
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.parentUri).toBe("");
  });

  it("dcterms:conformsTo references the schema.org class URI resolved from MIME type", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendToCatalog({
      catalogUri, instanceUri, binaryUri,
      classUri: "http://schema.org/TextDigitalDocument", parentUri,
      mediaType: "application/pdf", byteSize: 512000, title: "Report",
      description: "", modified, publisherWebId, fetch,
    });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.conformsTo).toBe("http://schema.org/TextDigitalDocument");
  });

  it("distribution carries accessURL, mediaType, and byteSize", async () => {
    const { calls } = await runAppend();
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.accessURL).toBe(binaryUri);
    expect(entry.mediaType).toBe("image/jpeg");
    expect(entry.byteSize).toBe(4_500_000);
  });

  it("the written entry keeps all its fields when read back", async () => {
    const { calls } = await runAppend({ description: "A sunny day photo" });
    const [entry] = parseCatalog(putBody(calls), catalogUri);

    expect(entry).toMatchObject({
      uri: instanceUri,
      conformsTo: classUri,
      title: "Summer Photo",
      description: "A sunny day photo",
      modified,
      publisher: publisherWebId,
      mediaType: "image/jpeg",
      byteSize: 4_500_000,
      accessURL: binaryUri,
      parentUri,
    });
  });

  it("omits dcterms:description from the written document when description is empty", async () => {
    const { calls } = await runAppend({ description: "" });
    expect(putBody(calls)).not.toContain("dcterms:description");
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.description).toBe("");
  });

  it("round-trips a title containing quotes, backslashes, and newlines", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    const trickyTitle = 'Q1 "Draft"\\report\nfinal';
    await appendToCatalog({
      catalogUri, instanceUri, binaryUri, classUri, parentUri,
      mediaType: "image/jpeg", byteSize: 100, title: trickyTitle,
      description: "", modified, publisherWebId, fetch,
    });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.title).toBe(trickyTitle);
  });

  it("throws when the catalog GET fails for a reason other than 404", async () => {
    const { fetch } = capturingMock({ status: 500 });
    await expect(appendToCatalog({
      catalogUri, instanceUri, binaryUri, classUri, parentUri,
      mediaType: "image/jpeg", byteSize: 100, title: "x",
      description: "", modified, publisherWebId, fetch,
    })).rejects.toThrow(`Failed to read ${catalogUri}`);
  });

  it("throws a message naming the document and pointing at the fix, not N3's bare parser text, when the existing catalog is malformed", async () => {
    const { fetch, calls } = capturingMock({ status: 200, body: "this is not valid turtle {{{ <<< >>>" });
    await expect(appendToCatalog({
      catalogUri, instanceUri, binaryUri, classUri, parentUri,
      mediaType: "image/jpeg", byteSize: 100, title: "x",
      description: "", modified, publisherWebId, fetch,
    })).rejects.toThrow(catalogUri);
    // Nothing gets written over the unreadable document.
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("throws when the PUT fails", async () => {
    const { fetch } = capturingMock({ status: 404 }, 500);
    await expect(appendToCatalog({
      catalogUri, instanceUri, binaryUri, classUri, parentUri,
      mediaType: "image/jpeg", byteSize: 100, title: "x",
      description: "", modified, publisherWebId, fetch,
    })).rejects.toThrow(`Failed to write ${catalogUri}`);
  });

  it("heals a catalog that parses partway: writes succeed against the recovered prefix, dropping the corrupted tail", async () => {
    const clean = capturingMock({ status: 404 });
    await appendToCatalog({
      catalogUri, instanceUri, binaryUri, classUri, parentUri,
      mediaType: "image/jpeg", byteSize: 100, title: "existing entry",
      description: "", modified, publisherWebId, fetch: clean.fetch,
    });
    const corrupted = `${putBody(clean.calls)}\nthis is not valid turtle {{{ <<< >>>`;

    const { fetch, calls } = capturingMock({ status: 200, body: corrupted });
    await appendToCatalog({
      catalogUri, instanceUri: `${instanceUri}-2`, binaryUri: `${binaryUri}-2`, classUri, parentUri,
      mediaType: "image/jpeg", byteSize: 200, title: "new entry",
      description: "", modified, publisherWebId, fetch,
    });

    const entries = parseCatalog(putBody(calls), catalogUri);
    expect(entries.map((entry) => entry.title)).toEqual(
      expect.arrayContaining(["existing entry", "new entry"])
    );
    expect(putBody(calls)).not.toContain("this is not valid turtle");
  });
});

// ─── appendFolderToCatalog ──────────────────────────────────────────────────

describe("appendFolderToCatalog", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const folderUri = "https://pod.example/my-app/documents/";
  const parentUri = "https://pod.example/my-app/";
  const publisherWebId = "https://pod.example/profile/card#me";
  const modified = "2026-03-16T00:00:00.000Z";

  it("reads the catalog, then PUTs the whole document back — a single GET/PUT round trip", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: "Documents", modified, publisherWebId, fetch });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(calls[1].contentType).toBe("text/turtle");
  });

  it("links the folder's own URI as the dataset, with no distribution", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: "Documents", modified, publisherWebId, fetch });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.uri).toBe(folderUri);
    expect(entry.accessURL).toBe("");
    expect(entry.mediaType).toBe("");
  });

  it("types the folder as both dcat:Dataset and sd:Folder, so isFolderEntry recognizes it", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: "Documents", modified, publisherWebId, fetch });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.conformsTo).toBe(FOLDER_CLASS_URI);
    expect(isFolderEntry(entry)).toBe(true);
  });

  it("links the folder to its parent via sd:hasParent", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: "Documents", modified, publisherWebId, fetch });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.parentUri).toBe(parentUri);
  });

  it("leaves out the parent-folder link for a folder with nothing above it, such as a trash item", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendFolderToCatalog({ catalogUri, folderUri, parentUri: "", title: "Documents", modified, publisherWebId, fetch });
    expect(putBody(calls)).not.toContain("hasParent");
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.parentUri).toBe("");
  });

  it("round-trips a title containing quotes", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: 'Q1 "Draft"', modified, publisherWebId, fetch });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.title).toBe('Q1 "Draft"');
  });

  it("throws when the catalog GET fails for a reason other than 404", async () => {
    const { fetch } = capturingMock({ status: 500 });
    await expect(appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: "Documents", modified, publisherWebId, fetch }))
      .rejects.toThrow(`Failed to read ${catalogUri}`);
  });

  it("throws when the PUT fails", async () => {
    const { fetch } = capturingMock({ status: 404 }, 500);
    await expect(appendFolderToCatalog({ catalogUri, folderUri, parentUri, title: "Documents", modified, publisherWebId, fetch }))
      .rejects.toThrow(`Failed to write ${catalogUri}`);
  });
});

// ─── ensureCatalogRootEntry ─────────────────────────────────────────────────

describe("ensureCatalogRootEntry", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const storageRootUri = "https://pod.example/";
  const publisherWebId = "https://pod.example/profile/card#me";

  it("reads the catalog, then PUTs the whole document back — a single GET/PUT round trip", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await ensureCatalogRootEntry({ catalogUri, storageRootUri, publisherWebId, fetch });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
  });

  it("declares the storage root as dcat:Dataset and sd:Folder, with no parent", async () => {
    const { fetch, calls } = capturingMock({ status: 404 });
    await ensureCatalogRootEntry({ catalogUri, storageRootUri, publisherWebId, fetch });
    const [entry] = parseCatalog(putBody(calls), catalogUri);
    expect(entry.uri).toBe(storageRootUri);
    expect(entry.conformsTo).toBe(FOLDER_CLASS_URI);
    expect(isFolderEntry(entry)).toBe(true);
    expect(entry.parentUri).toBe("");
  });

  it("is safe to call repeatedly: re-adding the same triples produces the same document, not duplicates", async () => {
    const first = capturingMock({ status: 404 });
    await ensureCatalogRootEntry({ catalogUri, storageRootUri, publisherWebId, fetch: first.fetch });
    const firstBody = putBody(first.calls);

    const second = capturingMock({ status: 200, body: firstBody });
    await ensureCatalogRootEntry({ catalogUri, storageRootUri, publisherWebId, fetch: second.fetch });

    expect(parseCatalog(putBody(second.calls), catalogUri)).toHaveLength(1);
  });

  it("throws when the catalog GET fails for a reason other than 404", async () => {
    const { fetch } = capturingMock({ status: 500 });
    await expect(ensureCatalogRootEntry({ catalogUri, storageRootUri, publisherWebId, fetch }))
      .rejects.toThrow(`Failed to read ${catalogUri}`);
  });

  it("throws when the PUT fails", async () => {
    const { fetch } = capturingMock({ status: 404 }, 500);
    await expect(ensureCatalogRootEntry({ catalogUri, storageRootUri, publisherWebId, fetch }))
      .rejects.toThrow(`Failed to write ${catalogUri}`);
  });
});

// ─── concurrent writes to the same catalog ─────────────────────────────────

describe("concurrent writes to the same catalog", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const publisherWebId = "https://pod.example/profile/card#me";
  const modified = "2026-03-16T00:00:00.000Z";

  async function waitUntil(condition: () => boolean) {
    for (let attempt = 0; attempt < 50 && !condition(); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /** Lets `times` rounds of already-queued microtasks resolve, without advancing real or fake timers. */
  async function flushMicrotasks(times: number) {
    for (let round = 0; round < times; round += 1) await Promise.resolve();
  }

  /**
   * A stateful mock: GET returns whatever the last PUT stored (404 until
   * the first one), and the *first* PUT stays pending until `releaseFirstPut`
   * is called, long enough for a second write's GET to start racing it if
   * nothing were serializing them.
   */
  function racingMock() {
    let stored = "";
    let putCount = 0;
    let releaseFirstPut: (() => void) | undefined;
    const firstPutGate = new Promise<void>((resolve) => {
      releaseFirstPut = resolve;
    });

    const fetch = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PUT") {
        putCount += 1;
        if (putCount === 1) await firstPutGate;
        stored = init!.body as string;
        return { ok: true, status: 200, statusText: "OK" } as Response;
      }
      if (stored === "") return { ok: false, status: 404, statusText: "Not Found", text: async () => "" } as Response;
      return { ok: true, status: 200, statusText: "OK", text: async () => stored } as Response;
    });

    return { fetch, releaseFirstPut: releaseFirstPut!, putCountRef: () => putCount, storedRef: () => stored };
  }

  it("keeps both writes instead of the second silently overwriting the first, when they overlap", async () => {
    const { fetch, releaseFirstPut, putCountRef, storedRef } = racingMock();

    const firstWrite = appendFolderToCatalog({
      catalogUri, folderUri: "https://pod.example/new-folder-test/", parentUri: "https://pod.example/",
      title: "new-folder-test", modified, publisherWebId, fetch,
    });
    
    await waitUntil(() => putCountRef() === 1);

    const callsBeforeSecondWrite = fetch.mock.calls.length;
    const secondWrite = appendFolderToCatalog({
      catalogUri, folderUri: "https://pod.example/new-folder-test/folder1/", parentUri: "https://pod.example/new-folder-test/",
      title: "folder1", modified, publisherWebId, fetch,
    });
    
    await flushMicrotasks(5);
    expect(fetch.mock.calls.length).toBe(callsBeforeSecondWrite);

    releaseFirstPut();
    await Promise.all([firstWrite, secondWrite]);

    const entries = parseCatalog(storedRef(), catalogUri);
    expect(entries.map((entry) => entry.title)).toEqual(
      expect.arrayContaining(["new-folder-test", "folder1"])
    );
    const folder1 = entries.find((entry) => entry.title === "folder1");
    expect(folder1?.parentUri).toBe("https://pod.example/new-folder-test/");
  });

  it("does not wedge the queue after a rejected write: a later write to the same catalog still succeeds", async () => {
    let getCount = 0;
    let stored = "";
    const fetch = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PUT") {
        stored = init!.body as string;
        return { ok: true, status: 200, statusText: "OK" } as Response;
      }
      getCount += 1;
      if (getCount === 1) return { ok: false, status: 500, statusText: "Server Error" } as Response;
      if (stored === "") return { ok: false, status: 404, statusText: "Not Found", text: async () => "" } as Response;
      return { ok: true, status: 200, statusText: "OK", text: async () => stored } as Response;
    });

    await expect(appendFolderToCatalog({
      catalogUri, folderUri: "https://pod.example/first-attempt/", parentUri: "https://pod.example/",
      title: "first-attempt", modified, publisherWebId, fetch,
    })).rejects.toThrow(`Failed to read ${catalogUri}`);

    await appendFolderToCatalog({
      catalogUri, folderUri: "https://pod.example/second-attempt/", parentUri: "https://pod.example/",
      title: "second-attempt", modified, publisherWebId, fetch,
    });

    const entries = parseCatalog(stored, catalogUri);
    expect(entries.map((entry) => entry.title)).toEqual(["second-attempt"]);
  });
});

// ─── isFolderEntry ──────────────────────────────────────────────────────────

describe("isFolderEntry", () => {
  const base: Omit<CatalogEntry, "conformsTo"> = {
    uri: "https://pod.example/my-app/documents/",
    title: "Documents", description: "", modified: "", publisher: "",
    mediaType: "", byteSize: 0, accessURL: "",
  };

  it("recognizes an entry using the current Folder type", () => {
    expect(isFolderEntry({ ...base, conformsTo: FOLDER_CLASS_URI })).toBe(true);
  });

  it("also recognizes the older marker folders used before this vocabulary existed, so old pods still list folders correctly", () => {
    expect(isFolderEntry({ ...base, conformsTo: LEGACY_FOLDER_CLASS_URI })).toBe(true);
  });

  it("does not mistake a file's own type for a folder", () => {
    expect(isFolderEntry({ ...base, conformsTo: "http://schema.org/ImageObject" })).toBe(false);
  });
});

// ─── buildEmptyCatalogTurtle ────────────────────────────────────────────────

describe("buildEmptyCatalogTurtle", () => {
  it("gives the empty catalog its own address, so it's understandable even outside its original location", () => {
    const turtle = buildEmptyCatalogTurtle("https://pod.example/catalog.ttl");
    expect(turtle).toContain("@base <https://pod.example/catalog.ttl> .");
  });

  it("marks the empty document as a catalog", () => {
    const turtle = buildEmptyCatalogTurtle("https://pod.example/catalog.ttl");
    expect(turtle).toContain("<> a dcat:Catalog .");
  });
});

// ─── removeFromCatalog ─────────────────────────────────────────────────────

describe("removeFromCatalog", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const instanceUri = "https://pod.example/my-app/photo/index.ttl";
  const keptUri = "https://pod.example/my-app/other/index.ttl";

  const turtleWithBoth = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    <${catalogUri}> dcat:dataset <${instanceUri}>, <${keptUri}> .
    <${instanceUri}> a dcat:Dataset ; dcterms:title "Gone" ; dcat:distribution <${instanceUri}#dist> .
    <${instanceUri}#dist> a dcat:Distribution ; dcat:mediaType "image/jpeg" .
    <${keptUri}> a dcat:Dataset ; dcterms:title "Stays" .
  `.trim();

  function mockWithHead(headStatus: number, getResponse: { status: number; body?: string } = { status: 200, body: turtleWithBoth }) {
    const calls: FetchCall[] = [];
    const fetchFn = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const headers = init?.headers as Record<string, string> | undefined;
      calls.push({ url: String(url), method, body: typeof init?.body === "string" ? init.body : undefined, contentType: headers?.["Content-Type"] });

      if (method === "HEAD") return { ok: headStatus < 400, status: headStatus } as Response;
      if (method === "PUT") return { ok: true, status: 200 } as Response;
      return { ok: getResponse.status < 400, status: getResponse.status, text: async () => getResponse.body ?? "" } as Response;
    });
    return { fetch: fetchFn, calls };
  }

  it("does nothing when the catalog does not exist (HEAD 404)", async () => {
    const { fetch, calls } = mockWithHead(404);
    await removeFromCatalog(catalogUri, instanceUri, fetch);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("HEAD");
  });

  it("does nothing when the HEAD check fails for a reason other than 404", async () => {
    const { fetch, calls } = mockWithHead(403);
    await removeFromCatalog(catalogUri, instanceUri, fetch);
    expect(calls).toHaveLength(1);
  });

  it("removes the dataset via a single GET/PUT round trip after the HEAD check", async () => {
    const { fetch, calls } = mockWithHead(200);
    await removeFromCatalog(catalogUri, instanceUri, fetch);
    expect(calls.map((call) => call.method)).toEqual(["HEAD", "GET", "PUT"]);
  });

  it("drops the target dataset's triples but keeps unrelated entries", async () => {
    const { fetch, calls } = mockWithHead(200);
    await removeFromCatalog(catalogUri, instanceUri, fetch);

    const entries = parseCatalog(putBody(calls), catalogUri);
    expect(entries.map((entry) => entry.title)).toEqual(["Stays"]);
  });

  it("drops the catalog-to-dataset link, the dataset's own triples, and the distribution's triples", async () => {
    const { fetch, calls } = mockWithHead(200);
    await removeFromCatalog(catalogUri, instanceUri, fetch);

    const body = putBody(calls);
    expect(body).not.toContain(instanceUri);
  });

  it("throws when the GET fails for a reason other than 404", async () => {
    const { fetch } = mockWithHead(200, { status: 500 });
    await expect(removeFromCatalog(catalogUri, instanceUri, fetch)).rejects.toThrow(`Failed to read ${catalogUri}`);
  });

  it("throws when the PUT fails", async () => {
    const calls: FetchCall[] = [];
    const fetchFn = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method });
      if (method === "HEAD") return { ok: true, status: 200 } as Response;
      if (method === "PUT") return { ok: false, status: 500, statusText: "Internal Server Error" } as Response;
      return { ok: true, status: 200, text: async () => turtleWithBoth } as Response;
    });
    await expect(removeFromCatalog(catalogUri, instanceUri, fetchFn)).rejects.toThrow(`Failed to write ${catalogUri}`);
  });
});

// ─── linkCatalogToProfile ──────────────────────────────────────────────────

describe("linkCatalogToProfile", () => {
  const catalogUri = "https://pod.example/catalog.ttl";
  const webId = "https://pod.example/profile/card#me";

  function mockFetch(status = 200) {
    const calls: FetchCall[] = [];
    const fetchFn = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
        contentType: headers?.["Content-Type"],
      });
      return { ok: status < 400, status, statusText: status < 400 ? "OK" : "Forbidden" } as Response;
    });
    return { fetch: fetchFn, calls };
  }

  it("PATCHes the profile document (fragment stripped from WebID)", async () => {
    const { fetch, calls } = mockFetch();
    await linkCatalogToProfile(catalogUri, webId, fetch);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe("https://pod.example/profile/card");
  });

  it("PATCH uses application/sparql-update content type", async () => {
    const { fetch, calls } = mockFetch();
    await linkCatalogToProfile(catalogUri, webId, fetch);
    expect(calls[0].contentType).toBe("application/sparql-update");
  });

  it("INSERT body contains dcat:catalog pointing to catalog.ttl", async () => {
    const { fetch, calls } = mockFetch();
    await linkCatalogToProfile(catalogUri, webId, fetch);
    const body = calls[0].body ?? "";
    expect(body).toContain("dcat:catalog");
    expect(body).toContain("https://pod.example/catalog.ttl");
  });

  it("INSERT uses INSERT DATA (not DELETE) — a surgical single-triple patch, not a full rewrite", async () => {
    const { fetch, calls } = mockFetch();
    await linkCatalogToProfile(catalogUri, webId, fetch);
    expect(calls[0].body).toContain("INSERT DATA");
    expect(calls[0].body).not.toContain("DELETE");
    expect(calls).toHaveLength(1);
  });

  it("throws when the profile PATCH fails", async () => {
    const { fetch } = mockFetch(403);
    await expect(linkCatalogToProfile(catalogUri, webId, fetch))
      .rejects.toThrow("Failed to link catalog to profile");
  });

  it("throws when catalogUri contains a '>' character", async () => {
    const { fetch } = mockFetch();
    await expect(linkCatalogToProfile("https://evil.example/><script>", webId, fetch))
      .rejects.toThrow("Unsafe URI");
  });

  it("throws when the WebID's profile document URI contains whitespace", async () => {
    const { fetch } = mockFetch();
    await expect(linkCatalogToProfile(catalogUri, "https://pod.example/my profile/card#me", fetch))
      .rejects.toThrow("Unsafe URI");
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
      parentUri: "",
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

  it("returns zero byteSize and empty strings for missing optional properties", () => {
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
    expect(entries[0].parentUri).toBe("");
  });

  it("parses catalog with baseUri parameter for resolving relative URIs", () => {
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

  it("excludes internal shared-catalog and system files from the entries", () => {
    const sharedHelperUri =
      "https://pod.example/my-solid-app/.shared-https%3A%2F%2Fcontact.example%2Fprofile%2Fcard.ttl";
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    <https://pod.example/my-solid-app/catalog.ttl> dcat:dataset
      <https://pod.example/my-solid-app/photo/index.ttl> ,
      <${sharedHelperUri}> ,
      <https://pod.example/my-solid-app/catalog.ttl> .
    <https://pod.example/my-solid-app/photo/index.ttl> a dcat:Dataset ;
       dcterms:title "Photo" .
    <${sharedHelperUri}> a dcat:Dataset ;
       dcterms:title "Internal" .
    <https://pod.example/my-solid-app/catalog.ttl> a dcat:Dataset ;
       dcterms:title "Catalog" .
    `.trim();
    const entries = parseCatalog(turtle, "https://pod.example/my-solid-app/catalog.ttl");
    expect(entries.map((entry) => entry.title)).toEqual(["Photo"]);
  });

  it("drops a conformsTo that points at a pod .ttl file instead of a real class", () => {
    const sharedHelperUri =
      "https://pod.example/my-solid-app/.shared-https%3A%2F%2Fcontact.example%2Fprofile%2Fcard.ttl";
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    <https://pod.example/my-solid-app/catalog.ttl> dcat:dataset
      <https://pod.example/my-solid-app/poster/index.ttl> .
    <https://pod.example/my-solid-app/poster/index.ttl> a dcat:Dataset ;
       dcterms:title "Poster" ;
       dcterms:conformsTo <${sharedHelperUri}> .
    `.trim();
    const [entry] = parseCatalog(turtle, "https://pod.example/my-solid-app/catalog.ttl");
    expect(entry.title).toBe("Poster");
    expect(entry.conformsTo).toBe("");
  });

  it("keeps a real schema.org conformsTo class", () => {
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    <https://pod.example/my-solid-app/catalog.ttl> dcat:dataset
      <https://pod.example/my-solid-app/photo/index.ttl> .
    <https://pod.example/my-solid-app/photo/index.ttl> a dcat:Dataset ;
       dcterms:conformsTo <http://schema.org/ImageObject> .
    `.trim();
    const [entry] = parseCatalog(turtle, "https://pod.example/my-solid-app/catalog.ttl");
    expect(entry.conformsTo).toBe("http://schema.org/ImageObject");
  });

  it("reads a folder entry correctly, including which folder it lives in", () => {
    const catalogUri = "https://pod.example/my-app/catalog.ttl";
    const folderUri = "https://pod.example/my-app/documents/";
    const parentUri = "https://pod.example/my-app/";
    const turtle = `
    @prefix dcat:    <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    @prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
    @prefix sd:      <${FOLDER_CLASS_URI.slice(0, -"Folder".length)}> .

    <${catalogUri}> dcat:dataset <${folderUri}> .
    <${folderUri}> a dcat:Dataset, sd:Folder ;
      dcterms:conformsTo <${FOLDER_CLASS_URI}> ;
      dcterms:title "Documents" ;
      dcterms:modified "2026-03-16T11:52:13.066Z"^^xsd:dateTime ;
      dcterms:publisher <https://pod.example/profile/card#me> ;
      sd:hasParent <${parentUri}> .
    `.trim();

    const [entry] = parseCatalog(turtle, catalogUri);
    expect(entry).toMatchObject({
      uri: folderUri,
      conformsTo: FOLDER_CLASS_URI,
      title: "Documents",
      mediaType: "",
      byteSize: 0,
      accessURL: "",
      parentUri,
    });
  });

  it("reads the storage root as having no parent folder", () => {
    const catalogUri = "https://pod.example/catalog.ttl";
    const storageRootUri = "https://pod.example/";
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .

    <${catalogUri}> dcat:dataset <${storageRootUri}> .
    <${storageRootUri}> a dcat:Dataset, <${FOLDER_CLASS_URI.slice(0, -"Folder".length)}Folder> ;
      dcterms:conformsTo <${FOLDER_CLASS_URI}> ;
      dcterms:publisher <https://pod.example/profile/card#me> .
    `.trim();

    const [entry] = parseCatalog(turtle, catalogUri);
    expect(entry.parentUri).toBe("");
  });
});

// ─── parseCatalogRecovering ─────────────────────────────────────────────────

describe("parseCatalogRecovering", () => {
  const catalogUri = "https://pod.example/catalog.ttl";

  it("returns the same entries as parseCatalog, with error: null, for well-formed turtle", () => {
    const instanceUri = "https://pod.example/report/index.ttl";
    const turtle = `
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .

    <${catalogUri}> dcat:dataset <${instanceUri}> .
    <${instanceUri}> a dcat:Dataset ;
      dcterms:title "Report" .
    `.trim();

    expect(parseCatalogRecovering(turtle, catalogUri)).toEqual({
      entries: parseCatalog(turtle, catalogUri),
      error: null,
    });
  });

  it("recovers every entry that appears before a corrupted tail, and reports the error naming the document", () => {
    const goodUri = "https://pod.example/report/index.ttl";
    const turtle = [
      "@prefix dcat: <http://www.w3.org/ns/dcat#> .",
      "@prefix dcterms: <http://purl.org/dc/terms/> .",
      "",
      `<${catalogUri}> dcat:dataset <${goodUri}> .`,
      `<${goodUri}> a dcat:Dataset ;`,
      '  dcterms:title "Report" .',
      "",
      "this is not valid turtle {{{ <<< >>>",
    ].join("\n");

    const result = parseCatalogRecovering(turtle, catalogUri);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ uri: goodUri, title: "Report" });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain(catalogUri);
  });

  it("returns no entries and a wrapped error when nothing in the document is recoverable", () => {
    const invalidTurtle = "this is not valid turtle {{{ <<< >>>";

    const result = parseCatalogRecovering(invalidTurtle, catalogUri);

    expect(result.entries).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain(catalogUri);
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

  it("returns the label when looked up by local ID string", () => {
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
