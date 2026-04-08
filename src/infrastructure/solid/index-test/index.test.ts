import { describe, it, expect } from "vitest";
import * as SolidModule from "..";

describe("infrastructure/solid/index exports", () => {
  const expectedFunctions = [
    // resourceGuards
    "isLoadable", "isReadable", "isBinary", "isDeletable", "isReloadable",
    "isSolidContainer", "isSolidLeaf",
    // profile
    "saveProfileFields", "ensureProfileDocType", "addContact", "removeContact",
    // catalog
    "resolveCatalogUri", "appendToCatalog", "removeFromCatalog",
    "parseCatalog", "linkCatalogToProfile",
    // sharedCatalog
    "getAppContainerUri", "getSharedCatalogUri", "getSharedCatalogFileName",
    "getCandidateSharedCatalogUris", "isSharedCatalogFile",
    "normalizeShareCatalogId", "toContainerUri", "hasAccess",
    // displayName
    "resolveDisplayName",
  ] as const;

  it.each(expectedFunctions)("exports %s as a function", (name) => {
    expect(typeof (SolidModule as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports EMPTY_CATALOG_TURTLE as a string", () => {
    expect(typeof SolidModule.EMPTY_CATALOG_TURTLE).toBe("string");
    expect(SolidModule.EMPTY_CATALOG_TURTLE.length).toBeGreaterThan(0);
  });

  it("re-exports APP_CONTAINER_PATH from config", () => {
    expect(typeof SolidModule.APP_CONTAINER_PATH).toBe("string");
  });

  it("re-exports SHARED_CATALOG_PREFIX from config", () => {
    expect(typeof SolidModule.SHARED_CATALOG_PREFIX).toBe("string");
  });
});
