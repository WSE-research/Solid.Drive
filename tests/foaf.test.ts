import { describe, it, expect, vi } from "vitest";
import { ensureProfileDocType, saveProfileFields, addContact, removeContact } from "../src/foaf";

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

  it("throws when webId is not a valid IRI", async () => {
    const mockFetch = vi.fn();
    await expect(ensureProfileDocType("not-a-url", mockFetch)).rejects.toThrow("Invalid webId");
    expect(mockFetch).not.toHaveBeenCalled();
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

  it("throws when webId is not a valid IRI", async () => {
    const mockFetch = vi.fn();
    await expect(saveProfileFields("not-a-url", EMPTY, { name: "Alice", imgUrl: "" }, mockFetch)).rejects.toThrow("Invalid webId");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("inserts foaf:img when imgUrl is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const imgUrl = "https://alice.example/public/avatar.jpg";
    await saveProfileFields(WEB_ID, EMPTY, { name: "", imgUrl }, mockFetch);

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("solid:inserts");
    expect(body).toContain(`foaf:img <${imgUrl}>`);
  });

  it("deletes old foaf:img and inserts new one when updating", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const oldImg = "https://alice.example/public/old.jpg";
    const newImg = "https://alice.example/public/new.jpg";
    await saveProfileFields(WEB_ID, { name: "", imgUrl: oldImg }, { name: "", imgUrl: newImg }, mockFetch);

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain("solid:deletes");
    expect(body).toContain(`foaf:img <${oldImg}>`);
    expect(body).toContain("solid:inserts");
    expect(body).toContain(`foaf:img <${newImg}>`);
  });

  it("throws when imgUrl is not a valid IRI", async () => {
    const mockFetch = vi.fn();
    await expect(
      saveProfileFields(WEB_ID, EMPTY, { name: "", imgUrl: "not-a-url" }, mockFetch)
    ).rejects.toThrow("Invalid image URL");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("escapes double quotes in name", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(WEB_ID, EMPTY, { name: 'O"Brien', imgUrl: "" }, mockFetch);

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain('foaf:name "O\\"Brien"');
  });

  it("escapes backslashes in name", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await saveProfileFields(WEB_ID, EMPTY, { name: "foo\\bar", imgUrl: "" }, mockFetch);

    const { body } = mockFetch.mock.calls[0][1];
    expect(body).toContain('foaf:name "foo\\\\bar"');
  });
});


describe("addContact", () => {
  it("PATCHes foaf:knows insert for the given contact", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const contactWebId = "https://bob.example/profile/card#me";
    await addContact(WEB_ID, contactWebId, mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PROFILE_DOC);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("text/n3");
    expect(init.body).toContain("solid:inserts");
    expect(init.body).toContain(`foaf:knows <${contactWebId}>`);
  });

  it("throws when the server returns an error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });
    await expect(addContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch)).rejects.toThrow("403 Forbidden");
  });

  it("throws when contactWebId is not a valid IRI", async () => {
    const mockFetch = vi.fn();
    await expect(addContact(WEB_ID, "not-a-url", mockFetch)).rejects.toThrow("Invalid contactWebId");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when webId is not a valid IRI", async () => {
    const mockFetch = vi.fn();
    await expect(addContact("not-a-url", "https://bob.example/profile/card#me", mockFetch)).rejects.toThrow("Invalid webId");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});


describe("removeContact", () => {
  it("PATCHes foaf:knows delete for the given contact", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const contactWebId = "https://bob.example/profile/card#me";
    await removeContact(WEB_ID, contactWebId, mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PROFILE_DOC);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("text/n3");
    expect(init.body).toContain("solid:deletes");
    expect(init.body).toContain(`foaf:knows <${contactWebId}>`);
  });

  it("throws when the server returns an error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });
    await expect(removeContact(WEB_ID, "https://bob.example/profile/card#me", mockFetch)).rejects.toThrow("403 Forbidden");
  });

  it("throws when contactWebId is not a valid IRI", async () => {
    const mockFetch = vi.fn();
    await expect(removeContact(WEB_ID, "not-a-url", mockFetch)).rejects.toThrow("Invalid contactWebId");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
