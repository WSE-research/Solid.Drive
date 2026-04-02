import { describe, expect, it } from "vitest";
import {
  getCandidateSharedCatalogUris,
  getSharedCatalogFileName,
  getSharedCatalogUri,
  normalizeShareCatalogId,
} from "../../src/shareCatalog";

describe("normalizeShareCatalogId", () => {
  it("strips the WebID fragment", () => {
    expect(normalizeShareCatalogId("https://bob.example/profile/card#me")).toBe("https://bob.example/profile/card");
  });
});

describe("getSharedCatalogFileName", () => {
  it("uses the normalized WebID so equivalent fragments map to the same manifest", () => {
    expect(getSharedCatalogFileName("https://bob.example/profile/card#me")).toBe(
      getSharedCatalogFileName("https://bob.example/profile/card#profile")
    );
  });
});

describe("getSharedCatalogUri", () => {
  it("creates a hidden manifest inside the app container", () => {
    expect(getSharedCatalogUri("https://alice.example/my-solid-app/", "https://bob.example/profile/card#me")).toBe(
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard.ttl"
    );
  });
});

describe("getCandidateSharedCatalogUris", () => {
  it("includes both the normalized and legacy exact WebID manifest paths", () => {
    expect(getCandidateSharedCatalogUris("https://alice.example/my-solid-app/", "https://bob.example/profile/card#me")).toEqual([
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard.ttl",
      "https://alice.example/my-solid-app/.shared-https%3A%2F%2Fbob.example%2Fprofile%2Fcard%23me.ttl",
    ]);
  });
});
