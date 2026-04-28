import { describe, expect, it, vi } from "vitest";
import {
  getCandidateSharedCatalogUris,
  getAppContainerUri,
  getSharedCatalogFileName,
  getSharedCatalogUri,
  hasAccess,
  isSharedCatalogFile,
  normalizeShareCatalogId,
  toContainerUri,
} from '../sharedCatalog-file/sharedCatalog';

// ─── normalizeShareCatalogId ───────────────────────────────────────────────────

describe("normalizeShareCatalogId", () => {
  it("strips the WebID fragment", () => {
    expect(normalizeShareCatalogId("https://bob.example/profile/card#me")).toBe("https://bob.example/profile/card");
  });

  it("returns the value unchanged when there is no fragment", () => {
    expect(normalizeShareCatalogId("https://bob.example/profile/card")).toBe("https://bob.example/profile/card");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeShareCatalogId("  https://bob.example/profile/card#me  ")).toBe("https://bob.example/profile/card");
  });
});

// ─── getAppContainerUri ────────────────────────────────────────────────────────

describe("getAppContainerUri", () => {
  it("appends the app container path to the storage root", () => {
    const result = getAppContainerUri("https://alice.example/");
    expect(result).toContain("https://alice.example/");
    expect(result.length).toBeGreaterThan("https://alice.example/".length);
  });
});

// ─── getSharedCatalogFileName ──────────────────────────────────────────────────

describe("getSharedCatalogFileName", () => {
  it("uses the normalized WebID so equivalent fragments map to the same manifest", () => {
    expect(getSharedCatalogFileName("https://bob.example/profile/card#me")).toBe(
      getSharedCatalogFileName("https://bob.example/profile/card#profile")
    );
  });

  it("produces a .ttl filename", () => {
    expect(getSharedCatalogFileName("https://bob.example/profile/card#me")).toMatch(/\.ttl$/);
  });
});

// ─── getSharedCatalogUri ───────────────────────────────────────────────────────

describe("getSharedCatalogUri", () => {
  it("creates a hidden manifest inside the app container", () => {
    expect(getSharedCatalogUri("https://alice.example/my-solid-app/", "https://bob.example/profile/card#me")).toBe(
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard.ttl"
    );
  });
});

// ─── getCandidateSharedCatalogUris ─────────────────────────────────────────────

describe("getCandidateSharedCatalogUris", () => {
  it("includes both the normalized and legacy exact WebID manifest paths when WebID has a fragment", () => {
    expect(getCandidateSharedCatalogUris("https://alice.example/my-solid-app/", "https://bob.example/profile/card#me")).toEqual([
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard.ttl",
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard%23me.ttl",
    ]);
  });

  it("returns a single entry when WebID has no fragment (normalized === raw)", () => {
    const uris = getCandidateSharedCatalogUris(
      "https://alice.example/my-solid-app/",
      "https://bob.example/profile/card"
    );
    expect(uris).toHaveLength(1);
    expect(uris[0]).toBe(
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard.ttl"
    );
  });
});

// ─── isSharedCatalogFile ───────────────────────────────────────────────────────

describe("isSharedCatalogFile", () => {
  it("returns true for a filename starting with the shared catalog prefix and ending in .ttl", () => {
    const fileName = getSharedCatalogFileName("https://bob.example/profile/card#me");
    expect(isSharedCatalogFile(fileName)).toBe(true);
  });

  it("returns false for a regular catalog filename", () => {
    expect(isSharedCatalogFile("catalog.ttl")).toBe(false);
  });

  it("returns false for a shared-prefix file without .ttl extension", () => {
    expect(isSharedCatalogFile(".shared-something.json")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isSharedCatalogFile("")).toBe(false);
  });
});

// ─── toContainerUri ────────────────────────────────────────────────────────────

describe("toContainerUri", () => {
  it("strips index.ttl from the end of a catalog entry URI", () => {
    expect(toContainerUri("https://pod.example/my-app/photo/index.ttl")).toBe(
      "https://pod.example/my-app/photo/"
    );
  });

  it("returns container URIs unchanged", () => {
    expect(toContainerUri("https://pod.example/my-app/photo/")).toBe(
      "https://pod.example/my-app/photo/"
    );
  });

  it("strips the final path segment for legacy entries that point at the binary directly", () => {
    expect(toContainerUri("https://pod.example/my-app/photo/photo.jpg")).toBe(
      "https://pod.example/my-app/photo/"
    );
  });
});

// ─── hasAccess ─────────────────────────────────────────────────────────────────

describe("hasAccess", () => {
  const makeFetch = (status: number) =>
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
    })) as unknown as typeof fetch;

  it("returns true when HEAD returns 200", async () => {
    expect(await hasAccess("https://pod.example/container/", makeFetch(200))).toBe(true);
  });

  it("returns false when HEAD returns 403", async () => {
    expect(await hasAccess("https://pod.example/container/", makeFetch(403))).toBe(false);
  });

  it("returns false when HEAD returns 404", async () => {
    expect(await hasAccess("https://pod.example/container/", makeFetch(404))).toBe(false);
  });

  it("returns false when fetch throws a network error", async () => {
    const errorFetch = vi.fn(async () => { throw new Error("network error"); }) as unknown as typeof fetch;
    expect(await hasAccess("https://pod.example/container/", errorFetch)).toBe(false);
  });
});
