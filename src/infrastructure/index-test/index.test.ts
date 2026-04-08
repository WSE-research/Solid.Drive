import { describe, it, expect } from "vitest";
import * as Infrastructure from "..";

describe("infrastructure/index exports", () => {
  it("re-exports solid module functions", () => {
    expect(typeof Infrastructure.isLoadable).toBe("function");
    expect(typeof Infrastructure.resolveDisplayName).toBe("function");
    expect(typeof Infrastructure.parseCatalog).toBe("function");
    expect(typeof Infrastructure.getSharedCatalogUri).toBe("function");
    expect(typeof Infrastructure.saveProfileFields).toBe("function");
  });

  it("re-exports wac module functions", () => {
    expect(typeof Infrastructure.discoverAclUri).toBe("function");
    expect(typeof Infrastructure.buildAclTurtle).toBe("function");
    expect(typeof Infrastructure.writeAcl).toBe("function");
    expect(typeof Infrastructure.buildListOnlyAclTurtle).toBe("function");
  });

  it("re-exports inbox module functions", () => {
    expect(typeof Infrastructure.discoverInboxUri).toBe("function");
    expect(typeof Infrastructure.listAccessRequests).toBe("function");
    expect(typeof Infrastructure.deleteAccessRequest).toBe("function");
    expect(typeof Infrastructure.postCatalogAccessRequest).toBe("function");
  });

  it("re-exports EMPTY_CATALOG_TURTLE constant", () => {
    expect(typeof Infrastructure.EMPTY_CATALOG_TURTLE).toBe("string");
  });
});
