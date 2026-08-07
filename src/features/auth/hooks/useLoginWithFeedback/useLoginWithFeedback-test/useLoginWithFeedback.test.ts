import { describe, it, expect } from "vitest";
import { describeLoginError } from "../useLoginWithFeedback-file/useLoginWithFeedback";

/** Echoes the key and its interpolations, so tests assert on mapping, not wording. */
const translate = (key: string, options: Record<string, unknown>) =>
  `${key}|${JSON.stringify(options)}`;

const keyOf = (message: string) => message.split("|")[0];

describe("describeLoginError", () => {
  it("maps a 404 to the not-a-provider message", () => {
    // What a path-hosted identity provider produces: the OIDC client looks the
    // configuration up at the origin root and finds nothing there.
    const message = describeLoginError(
      new Error("HTTP error! Status: 404"),
      "https://wse-research.org/solid-community-server/",
      translate,
    );
    expect(keyOf(message)).toBe("auth.loginError.notAProvider");
    expect(message).toContain("https://wse-research.org/solid-community-server/");
  });

  it("maps an RFC 9207 issuer mismatch, keeping the detail", () => {
    const raw = "RFC 9207 - iss !== idp - https://a/ !== https://b/";
    const message = describeLoginError(new Error(raw), "https://b/", translate);
    expect(keyOf(message)).toBe("auth.loginError.issuerMismatch");
    expect(message).toContain("iss !== idp");
  });

  it("maps 5xx to provider-unavailable", () => {
    for (const status of [500, 502, 503]) {
      const message = describeLoginError(new Error(`HTTP error! Status: ${status}`), "https://x/", translate);
      expect(keyOf(message)).toBe("auth.loginError.providerUnavailable");
    }
  });

  it("maps a TypeError from fetch to unreachable", () => {
    const message = describeLoginError(new TypeError("Failed to fetch"), "https://x/", translate);
    expect(keyOf(message)).toBe("auth.loginError.unreachable");
  });

  it("does not mistake a 404 inside a URL for a status code", () => {
    // Guards the regex: the digits have to follow "Status:", not merely appear.
    const message = describeLoginError(new Error("Failed to fetch"), "https://x/404/", translate);
    expect(keyOf(message)).toBe("auth.loginError.unreachable");
  });

  it("falls back to the generic message and keeps the raw detail", () => {
    const message = describeLoginError(new Error("something odd"), "https://x/", translate);
    expect(keyOf(message)).toBe("auth.loginError.generic");
    expect(message).toContain("something odd");
  });

  it("handles a non-Error rejection", () => {
    const message = describeLoginError("plain string", "https://x/", translate);
    expect(keyOf(message)).toBe("auth.loginError.generic");
    expect(message).toContain("plain string");
  });

  it("always names the provider, whatever the branch", () => {
    const issuer = "https://provider.example/pod/";
    for (const error of [
      new Error("HTTP error! Status: 404"),
      new Error("RFC 9207 - iss !== idp"),
      new Error("HTTP error! Status: 503"),
      new TypeError("Failed to fetch"),
      new Error("weird"),
    ]) {
      expect(describeLoginError(error, issuer, translate)).toContain(issuer);
    }
  });
});
