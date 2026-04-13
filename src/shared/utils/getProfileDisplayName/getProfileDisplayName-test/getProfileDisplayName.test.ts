import { describe, it, expect } from "vitest";
import { getWebIdFallbackName, getProfileDisplayName } from '../getProfileDisplayName-file/getProfileDisplayName';

// ─── getWebIdFallbackName ──────────────────────────────────────────────────────

describe("getWebIdFallbackName", () => {
  it("extracts the host segment from a standard Solid WebID", () => {
    const result = getWebIdFallbackName("https://alice.solidcommunity.net/profile/card#me");
    expect(result).toBe("alice.solidcommunity.net");
  });

  it("skips 'profile' and 'card' path segments", () => {
    const result = getWebIdFallbackName("https://bob.example.org/profile/card#me");
    expect(result).toBe("bob.example.org");
  });

  it("returns the host segment when all path segments are generic", () => {
    // The function returns the first segment that doesn't start with "http" and
    // isn't "profile"/"card" — for this URL that is the host.
    const result = getWebIdFallbackName("https://example.com/users/charlie");
    expect(result).toBe("example.com");
  });

  it("falls back to the full WebID when no usable segment exists", () => {
    const result = getWebIdFallbackName("https://example.com");
    expect(result).toBe("example.com");
  });

  it("falls back to raw webId when all segments are profile/card/http-prefixed", () => {
    // After removing fragment: "https://profile/card"
    // Segments: ["https:", "profile", "card"] — all excluded
    const result = getWebIdFallbackName("https://profile/card#me");
    expect(result).toBe("https://profile/card#me");
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
    expect(getProfileDisplayName({}, webId)).toBe("alice.solidcommunity.net");
  });

  it("falls back to the WebID-derived name when profile is undefined", () => {
    expect(getProfileDisplayName(undefined, webId)).toBe("alice.solidcommunity.net");
  });
});
