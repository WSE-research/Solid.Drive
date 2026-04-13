import { describe, it, expect, vi } from "vitest";
import { resolveDisplayName } from '../displayName-file/displayName';

const WEB_ID = "https://alice.example/profile/card#me";
const PROFILE_DOC = "https://alice.example/profile/card";

const FOAF_NS = "http://xmlns.com/foaf/0.1/";
const VCARD_NS = "http://www.w3.org/2006/vcard/ns#";

function makeFetch(status: number, body = "") {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  })) as unknown as typeof fetch;
}

// ─── resolveDisplayName ────────────────────────────────────────────────────────

describe("resolveDisplayName", () => {
  it("strips the fragment to fetch the profile document", async () => {
    const turtle = `@prefix foaf: <${FOAF_NS}> . <${WEB_ID}> foaf:name "Alice" .`;
    const fetchFn = makeFetch(200, turtle);
    await resolveDisplayName(WEB_ID, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(PROFILE_DOC, expect.objectContaining({ headers: expect.anything() }));
  });

  it("returns vcard:fn when present", async () => {
    const turtle = `
      @prefix vcard: <${VCARD_NS}> .
      @prefix foaf:  <${FOAF_NS}> .
      <${WEB_ID}> vcard:fn "Alice Vcard" ; foaf:name "Alice Foaf" .
    `;
    const result = await resolveDisplayName(WEB_ID, makeFetch(200, turtle));
    expect(result).toBe("Alice Vcard");
  });

  it("falls back to foaf:name when vcard:fn is absent", async () => {
    const turtle = `@prefix foaf: <${FOAF_NS}> . <${WEB_ID}> foaf:name "Alice Foaf" .`;
    const result = await resolveDisplayName(WEB_ID, makeFetch(200, turtle));
    expect(result).toBe("Alice Foaf");
  });

  it("returns the WebID when profile fetch returns non-OK status", async () => {
    const result = await resolveDisplayName(WEB_ID, makeFetch(403));
    expect(result).toBe(WEB_ID);
  });

  it("returns the WebID when the profile has no name or fn triple", async () => {
    const turtle = `@prefix foaf: <${FOAF_NS}> . <${WEB_ID}> foaf:knows <https://bob.example/> .`;
    const result = await resolveDisplayName(WEB_ID, makeFetch(200, turtle));
    expect(result).toBe(WEB_ID);
  });

  it("returns the WebID when fetch throws a network error", async () => {
    const errorFetch = vi.fn(async () => { throw new Error("network failure"); }) as unknown as typeof fetch;
    const result = await resolveDisplayName(WEB_ID, errorFetch);
    expect(result).toBe(WEB_ID);
  });
});
