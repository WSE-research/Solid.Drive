import { describe, it, expect, vi } from "vitest";
import { ensureProfileDocType, saveProfileFields } from "../src/foaf";

const WEB_ID = "https://alice.example/profile/card#me";
const PROFILE_DOC = "https://alice.example/profile/card";


describe("ensureProfileDocType", () => {
  it("PATCHes the profile document with N3 Patch format", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await ensureProfileDocType(WEB_ID, mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PROFILE_DOC);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("text/n3");
    expect(init.body).toContain("foaf:PersonalProfileDocument");
    expect(init.body).toContain("foaf:primaryTopic");
    expect(init.body).toContain("solid:InsertDeletePatch");
  });

  it("throws when the server returns an error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });
    await expect(ensureProfileDocType(WEB_ID, mockFetch)).rejects.toThrow("403 Forbidden");
  });

  it("derives profile document URI by stripping the fragment", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await ensureProfileDocType("https://bob.example/profile/card#me", mockFetch);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://bob.example/profile/card");
    expect(url).not.toContain("#");
  });
});


const EMPTY = { name: "", imgUrl: "" };

describe("saveProfileFields", () => {
  it("does nothing when both original and fields are empty", async () => {
    const mockFetch = vi.fn();
    await saveProfileFields(WEB_ID, EMPTY, EMPTY, mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends a single N3 PATCH with inserts only when original is empty", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(WEB_ID, EMPTY, { name: "Alice", imgUrl: "" }, mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PROFILE_DOC);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("text/n3");
    expect(init.body).toContain("solid:inserts");
    expect(init.body).toContain('foaf:name "Alice"');
    expect(init.body).not.toContain("solid:deletes");
  });

  it("sends deletes and inserts when updating an existing name", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(
      WEB_ID,
      { name: "Aurora", imgUrl: "" },
      { name: "Parnian", imgUrl: "" },
      mockFetch
    );

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("solid:deletes");
    expect(body).toContain('foaf:name "Aurora"');
    expect(body).toContain("solid:inserts");
    expect(body).toContain('foaf:name "Parnian"');
  });

  it("sends only deletes when clearing a field", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(
      WEB_ID,
      { name: "Aurora", imgUrl: "" },
      EMPTY,
      mockFetch
    );

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("solid:deletes");
    expect(body).toContain('foaf:name "Aurora"');
    expect(body).not.toContain("solid:inserts");
  });

  it("throws when the server returns an error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 501, statusText: "Not Implemented" });
    await expect(
      saveProfileFields(WEB_ID, EMPTY, { name: "Alice", imgUrl: "" }, mockFetch)
    ).rejects.toThrow("501 Not Implemented");
  });

  it("uses relative <#me> URI not absolute WebID in patch body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(WEB_ID, EMPTY, { name: "Alice", imgUrl: "" }, mockFetch);

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("<#me>");
    expect(body).not.toContain(WEB_ID);
  });
});
