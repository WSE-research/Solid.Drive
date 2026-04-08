import { describe, it, expect, vi } from "vitest";
import { addContact, ensureProfileDocType, removeContact, saveProfileFields } from '../profile-file/profile';

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

  it("includes foaf:img in solid:inserts when imgUrl is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(
      WEB_ID,
      EMPTY,
      { name: "", imgUrl: "https://alice.example/photo.jpg" },
      mockFetch
    );
    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("solid:inserts");
    expect(body).toContain("foaf:img");
    expect(body).toContain("<https://alice.example/photo.jpg>");
  });

  it("includes foaf:img in solid:deletes when old imgUrl is replaced", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(
      WEB_ID,
      { name: "", imgUrl: "https://alice.example/old.jpg" },
      { name: "", imgUrl: "https://alice.example/new.jpg" },
      mockFetch
    );
    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("solid:deletes");
    expect(body).toContain("<https://alice.example/old.jpg>");
    expect(body).toContain("solid:inserts");
    expect(body).toContain("<https://alice.example/new.jpg>");
  });

  it("throws when imgUrl is not a valid http(s) URL", async () => {
    const mockFetch = vi.fn();
    await expect(
      saveProfileFields(WEB_ID, EMPTY, { name: "", imgUrl: "not-a-url" }, mockFetch)
    ).rejects.toThrow("Invalid image URL");
  });

  it("throws when webId is not a valid http(s) URL", async () => {
    const mockFetch = vi.fn();
    await expect(
      saveProfileFields("not-a-webid", EMPTY, { name: "Alice", imgUrl: "" }, mockFetch)
    ).rejects.toThrow("Invalid webId");
  });
});

// ─── addContact ────────────────────────────────────────────────────────────────

describe("addContact", () => {
  it("PATCHes the profile document with solid:inserts containing foaf:knows", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await addContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PROFILE_DOC);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("text/n3");
    expect(init.body).toContain("foaf:knows");
    expect(init.body).toContain("<https://bob.example/profile/card#me>");
    expect(init.body).toContain("solid:inserts");
  });

  it("derives profile document URI by stripping the WebID fragment", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await addContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch);
    expect(mockFetch.mock.calls[0][0]).toBe(PROFILE_DOC);
  });

  it("throws when the PATCH fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });
    await expect(addContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch)).rejects.toThrow("403");
  });

  it("throws when contactWebId is not a valid URL", async () => {
    const mockFetch = vi.fn();
    await expect(addContact(WEB_ID, "not-a-url", mockFetch)).rejects.toThrow("Invalid contactWebId");
  });
});

// ─── removeContact ─────────────────────────────────────────────────────────────

describe("removeContact", () => {
  it("PATCHes the profile document with solid:deletes containing foaf:knows", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await removeContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PROFILE_DOC);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("text/n3");
    expect(init.body).toContain("foaf:knows");
    expect(init.body).toContain("<https://bob.example/profile/card#me>");
    expect(init.body).toContain("solid:deletes");
    expect(init.body).not.toContain("solid:inserts");
  });

  it("throws when the PATCH fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    await expect(removeContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch)).rejects.toThrow("500");
  });

  it("throws when contactWebId is not a valid URL", async () => {
    const mockFetch = vi.fn();
    await expect(removeContact(WEB_ID, "not-a-url", mockFetch)).rejects.toThrow("Invalid contactWebId");
  });
});
