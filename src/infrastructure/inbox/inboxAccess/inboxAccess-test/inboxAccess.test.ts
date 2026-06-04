import { describe, it, expect, vi } from "vitest";
import type { FetchFn } from "@/types/solid";
import {
  discoverInboxUri,
  postCatalogAccessRequest,
  postFileAccessRequest,
  postTypeAccessRequest,
  postRejectionNotification,
  postApprovalNotification,
  listOutcomeNotifications,
  listAccessRequests,
  deleteAccessRequest,
} from '../inboxAccess-file/inboxAccess';
import { buildAccessRequestMessage, buildAccessRejectionMessage, buildAccessApprovalMessage } from "../../inboxMessages";

const LDP_NS = "http://www.w3.org/ns/ldp#";

const PROFILE_WITH_INBOX = `
  @prefix ldp: <${LDP_NS}> .
  <https://alice.example/profile/card#me> ldp:inbox <https://alice.example/inbox/> .
`;

const INBOX_WITH_TWO_MESSAGES = `
  @prefix ldp: <${LDP_NS}> .
  <https://alice.example/inbox/> ldp:contains <https://alice.example/inbox/msg1>, <https://alice.example/inbox/msg2> .
`;

const makeFetch = (responses: Record<string, { status: number; headers?: Record<string, string>; body?: string }>) =>
  vi.fn(async (url: RequestInfo, init?: RequestInit) => {
    const urlStr = url as string;
    const key = `${init?.method ?? "GET"} ${urlStr}`;
    const match = responses[key] ?? responses[urlStr] ?? { status: 404 };
    return {
      ok: match.status >= 200 && match.status < 300,
      status: match.status,
      statusText: String(match.status),
      headers: { get: (header: string) => match.headers?.[header] ?? null },
      text: async () => match.body ?? "",
    } as unknown as Response;
  });

// ─── discoverInboxUri ─────────────────────────────────────────────────────────

describe("discoverInboxUri", () => {
  it("fetches the profile and returns the inbox URI", async () => {
    const mockFetch = makeFetch({
      "https://alice.example/profile/card": { status: 200, body: PROFILE_WITH_INBOX },
    });
    const result = await discoverInboxUri("https://alice.example/profile/card#me", mockFetch);
    expect(result).toBe("https://alice.example/inbox/");
  });

  it("throws when the profile fetch fails", async () => {
    const mockFetch = makeFetch({
      "https://alice.example/profile/card": { status: 404 },
    });
    await expect(discoverInboxUri("https://alice.example/profile/card#me", mockFetch)).rejects.toThrow("404");
  });

  it("strips the WebID fragment to fetch the profile document", async () => {
    const mockFetch = makeFetch({
      "https://alice.example/profile/card": { status: 200, body: PROFILE_WITH_INBOX },
    });
    await discoverInboxUri("https://alice.example/profile/card#me", mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://alice.example/profile/card",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "text/turtle" }) })
    );
  });
});

// ─── postCatalogAccessRequest ─────────────────────────────────────────────────

describe("postCatalogAccessRequest", () => {
  it("POSTs to the inbox URI with text/turtle content-type", async () => {
    const mockFetch = makeFetch({ "POST https://alice.example/inbox/": { status: 201 } });
    await postCatalogAccessRequest(
      "https://alice.example/inbox/",
      "https://requester.example/profile/card#me",
      "https://alice.example/profile/card#me",
      mockFetch
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://alice.example/inbox/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "text/turtle" }),
      })
    );
  });

  it("throws when POST fails with non-2xx status", async () => {
    const mockFetch = makeFetch({ "POST https://alice.example/inbox/": { status: 403 } });
    await expect(
      postCatalogAccessRequest(
        "https://alice.example/inbox/",
        "https://requester.example/profile/card#me",
        "https://alice.example/profile/card#me",
        mockFetch
      )
    ).rejects.toThrow("403");
  });
});

// ─── postFileAccessRequest ────────────────────────────────────────────────────

describe("postFileAccessRequest", () => {
  it("POSTs a file access request to the inbox", async () => {
    const mockFetch = makeFetch({ "POST https://alice.example/inbox/": { status: 201 } });
    await postFileAccessRequest(
      "https://alice.example/inbox/",
      "https://requester.example/profile/card#me",
      "https://alice.example/files/videos/",
      mockFetch
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://alice.example/inbox/",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws an error when POST returns a non-2xx status code", async () => {
    const mockFetch = makeFetch({ "POST https://alice.example/inbox/": { status: 500 } });
    await expect(
      postFileAccessRequest(
        "https://alice.example/inbox/",
        "https://requester.example/profile/card#me",
        "https://alice.example/files/videos/",
        mockFetch
      )
    ).rejects.toThrow("500");
  });
});

// ─── postTypeAccessRequest ────────────────────────────────────────────────────

describe("postTypeAccessRequest", () => {
  it("POSTs a type access request to the inbox with text/turtle content-type", async () => {
    const mockFetch = makeFetch({ "POST https://alice.example/inbox/": { status: 201 } });
    await postTypeAccessRequest(
      "https://alice.example/inbox/",
      "https://requester.example/profile/card#me",
      "http://schema.org/ImageObject",
      mockFetch
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://alice.example/inbox/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "text/turtle" }),
      })
    );
  });

  it("sends a body containing solid-access:forClass with the class URI", async () => {
    let capturedBody = "";
    const mockFetch = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      capturedBody = (init?.body as string) ?? "";
      return { ok: true, status: 201, statusText: "Created", text: async () => "" } as unknown as Response;
    });
    await postTypeAccessRequest(
      "https://alice.example/inbox/",
      "https://requester.example/profile/card#me",
      "http://schema.org/ImageObject",
      mockFetch as unknown as FetchFn
    );
    expect(capturedBody).toContain("forClass");
    expect(capturedBody).toContain("http://schema.org/ImageObject");
  });

  it("throws when POST returns a non-2xx status code", async () => {
    const mockFetch = makeFetch({ "POST https://alice.example/inbox/": { status: 500 } });
    await expect(
      postTypeAccessRequest(
        "https://alice.example/inbox/",
        "https://requester.example/profile/card#me",
        "http://schema.org/ImageObject",
        mockFetch
      )
    ).rejects.toThrow("500");
  });
});

// ─── postRejectionNotification ────────────────────────────────────────────────

describe("postRejectionNotification", () => {
  it("POSTs a rejection message to the requester's inbox", async () => {
    const mockFetch = makeFetch({ "POST https://requester.example/inbox/": { status: 201 } });
    await postRejectionNotification(
      "https://requester.example/inbox/",
      "https://alice.example/files/videos/",
      mockFetch
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://requester.example/inbox/",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ─── postApprovalNotification ─────────────────────────────────────────────────

describe("postApprovalNotification", () => {
  it("POSTs an approval message to the requester's inbox", async () => {
    const mockFetch = makeFetch({ "POST https://requester.example/inbox/": { status: 201 } });
    await postApprovalNotification("https://requester.example/inbox/", "https://owner.example/profile/card#me", mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://requester.example/inbox/",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ─── listAccessRequests ───────────────────────────────────────────────────────

describe("listAccessRequests", () => {
  it("returns an empty array when the inbox returns 404", async () => {
    const mockFetch = makeFetch({ "https://alice.example/inbox/": { status: 404 } });
    const result = await listAccessRequests("https://alice.example/inbox/", mockFetch);
    expect(result).toEqual([]);
  });

  it("throws when the inbox returns a non-404 error", async () => {
    const mockFetch = makeFetch({ "https://alice.example/inbox/": { status: 403 } });
    await expect(listAccessRequests("https://alice.example/inbox/", mockFetch)).rejects.toThrow("403");
  });

  it("returns parsed access requests from inbox messages", async () => {
    const requesterWebId = "https://requester.example/profile/card#me";
    const accessTo = "https://alice.example/profile/card#me";
    const requestTurtle = buildAccessRequestMessage("catalog", requesterWebId, accessTo);

    const mockFetch = makeFetch({
      "https://alice.example/inbox/": { status: 200, body: INBOX_WITH_TWO_MESSAGES },
      "https://alice.example/inbox/msg1": { status: 200, body: requestTurtle },
      "https://alice.example/inbox/msg2": { status: 404 },
    });

    const result = await listAccessRequests("https://alice.example/inbox/", mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].requesterWebId).toBe(requesterWebId);
    expect(result[0].accessTo).toBe(accessTo);
    expect(result[0].requestType).toBe("catalog");
  });

  it("skips messages that are not access requests", async () => {
    const nonRequestTurtle = `@prefix foaf: <http://xmlns.com/foaf/0.1/> . <> foaf:name "irrelevant" .`;
    const mockFetch = makeFetch({
      "https://alice.example/inbox/": { status: 200, body: INBOX_WITH_TWO_MESSAGES },
      "https://alice.example/inbox/msg1": { status: 200, body: nonRequestTurtle },
      "https://alice.example/inbox/msg2": { status: 200, body: nonRequestTurtle },
    });

    const result = await listAccessRequests("https://alice.example/inbox/", mockFetch);
    expect(result).toEqual([]);
  });

  it("skips messages and returns them excluded when individual message fetch throws", async () => {
    const mockFetch = vi.fn(async (url: RequestInfo) => {
      const urlStr = url as string;
      if (urlStr === "https://alice.example/inbox/") {
        return { ok: true, status: 200, text: () => Promise.resolve(INBOX_WITH_TWO_MESSAGES) };
      }
      throw new Error("network error");
    });

    const result = await listAccessRequests("https://alice.example/inbox/", mockFetch as unknown as FetchFn);
    expect(result).toEqual([]);
  });
});

// ─── listOutcomeNotifications ─────────────────────────────────────────────────

describe("listOutcomeNotifications", () => {
  const INBOX = "https://requester.example/inbox/";
  const inboxTurtle = `
    @prefix ldp: <${LDP_NS}> .
    <${INBOX}> ldp:contains <${INBOX}msg1>, <${INBOX}msg2> .
  `;

  it("returns empty outcomes when the inbox fetch fails", async () => {
    const mockFetch = makeFetch({ [INBOX]: { status: 500 } });
    expect(await listOutcomeNotifications(INBOX, mockFetch)).toEqual({ approvals: [], rejections: [] });
  });

  it("sorts each message into approvals or rejections in a single pass", async () => {
    const accessTo = "https://owner.example/profile/card#me";
    const mockFetch = makeFetch({
      [INBOX]: { status: 200, body: inboxTurtle },
      [`${INBOX}msg1`]: { status: 200, body: buildAccessApprovalMessage(accessTo) },
      [`${INBOX}msg2`]: { status: 200, body: buildAccessRejectionMessage(accessTo) },
    });

    const { approvals, rejections } = await listOutcomeNotifications(INBOX, mockFetch);
    expect(approvals.map((a) => a.messageUri)).toEqual([`${INBOX}msg1`]);
    expect(rejections.map((r) => r.messageUri)).toEqual([`${INBOX}msg2`]);
  });

  it("fetches each message only once", async () => {
    const accessTo = "https://owner.example/profile/card#me";
    const mockFetch = makeFetch({
      [INBOX]: { status: 200, body: inboxTurtle },
      [`${INBOX}msg1`]: { status: 200, body: buildAccessApprovalMessage(accessTo) },
      [`${INBOX}msg2`]: { status: 200, body: buildAccessRejectionMessage(accessTo) },
    });

    await listOutcomeNotifications(INBOX, mockFetch);
    const messageFetches = mockFetch.mock.calls.filter(([url]) => String(url).startsWith(`${INBOX}msg`));
    expect(messageFetches).toHaveLength(2);
  });

  it("skips messages that fail or are neither approval nor rejection", async () => {
    const mockFetch = makeFetch({
      [INBOX]: { status: 200, body: inboxTurtle },
      [`${INBOX}msg1`]: { status: 403 },
      [`${INBOX}msg2`]: { status: 200, body: `<> a <http://example.org/Other> .` },
    });

    expect(await listOutcomeNotifications(INBOX, mockFetch)).toEqual({ approvals: [], rejections: [] });
  });
});

// ─── deleteAccessRequest ──────────────────────────────────────────────────────

describe("deleteAccessRequest", () => {
  it("sends a DELETE request to the message URI", async () => {
    const mockFetch = makeFetch({ "DELETE https://alice.example/inbox/msg1": { status: 200 } });
    await deleteAccessRequest("https://alice.example/inbox/msg1", mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://alice.example/inbox/msg1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("does not throw when DELETE returns 404", async () => {
    const mockFetch = makeFetch({ "DELETE https://alice.example/inbox/msg1": { status: 404 } });
    await expect(deleteAccessRequest("https://alice.example/inbox/msg1", mockFetch)).resolves.toBeUndefined();
  });

  it("throws when DELETE returns a non-404 error", async () => {
    const mockFetch = makeFetch({ "DELETE https://alice.example/inbox/msg1": { status: 403 } });
    await expect(deleteAccessRequest("https://alice.example/inbox/msg1", mockFetch)).rejects.toThrow("403");
  });
});
