import { describe, it, expect } from "vitest";
import { resolveCatalogUri } from "../src/useCatalogUri";
import type { SolidProfile } from "../src/.ldo/solidProfile.typings";

describe("resolveCatalogUri", () => {
  it("returns undefined when storageRoot is empty", () => {
    expect(resolveCatalogUri(undefined, "")).toBeUndefined();
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
