import { describe, it, expect } from "vitest";
import { getWebIdFallbackName, getProfileDisplayName } from '../getProfileDisplayName-file/getProfileDisplayName';

// ─── getWebIdFallbackName ──────────────────────────────────────────────────────

describe("getWebIdFallbackName", () => {
  it("extracts the leftmost subdomain for Pod-per-subdomain WebIDs", () => {
    const result = getWebIdFallbackName("https://alice.solidcommunity.net/profile/card#me");
    expect(result).toBe("alice");
  });

  it("preserves usernames with hyphens or underscores", () => {
    expect(getWebIdFallbackName("https://aurora-salvatore.solidcommunity.net/profile/card#me")).toBe("aurora-salvatore");
    expect(getWebIdFallbackName("https://test_htwk.solidcommunity.net/profile/card#me")).toBe("test_htwk");
  });

  it("extracts a meaningful path segment for Pod-as-path WebIDs", () => {
    const result = getWebIdFallbackName("https://example.com/users/charlie");
    expect(result).toBe("charlie");
  });

  it("returns the host when there is no usable subdomain or path segment", () => {
    expect(getWebIdFallbackName("https://example.com")).toBe("example.com");
    expect(getWebIdFallbackName("https://example.com/profile/card#me")).toBe("example.com");
  });

  it("returns the raw WebID when it cannot be parsed as a URL", () => {
    expect(getWebIdFallbackName("not a url")).toBe("not a url");
  });
});

// ─── getProfileDisplayName ─────────────────────────────────────────────────────

describe("getProfileDisplayName", () => {
  const webId = "https://alice.solidcommunity.net/profile/card#me";

  it("returns profile.name when available", () => {
    expect(getProfileDisplayName({ name: "Alice" }, webId)).toBe("Alice");
  });

  it("returns profile.fn when name is absent", () => {
    expect(getProfileDisplayName({ fn: "Alice Liddell" }, webId)).toBe("Alice Liddell");
  });

  it("prefers name over fn", () => {
    expect(getProfileDisplayName({ name: "Alice", fn: "Alice L." }, webId)).toBe("Alice");
  });

  it("falls back to the WebID-derived name when profile has no name or fn", () => {
    expect(getProfileDisplayName({}, webId)).toBe("alice");
  });

  it("falls back to the WebID-derived name when profile is undefined", () => {
    expect(getProfileDisplayName(undefined, webId)).toBe("alice");
  });

  it("treats blank name and fn as missing so the WebID fallback wins", () => {
    expect(getProfileDisplayName({ name: "", fn: "   " }, webId)).toBe("alice");
  });
});
