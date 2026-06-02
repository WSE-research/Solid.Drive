import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockFetch = vi.fn();
const mockDiscoverInboxUri = vi.fn();
const mockListOutcomeNotifications = vi.fn();

vi.mock("@ldo/solid-react", () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock("@/infrastructure/inbox/inboxAccess", () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
  listOutcomeNotifications: (...args: unknown[]) => mockListOutcomeNotifications(...args),
}));

import { useContactRejections } from "../useContactRejections-file/useContactRejections";

const VIEWER = "https://viewer.example/profile/card#me";
const INBOX = "https://viewer.example/inbox/";

const rejection = { messageUri: `${INBOX}r1`, accessTo: "https://owner.example/files/a/" };
const approval = { messageUri: `${INBOX}a1`, accessTo: "https://owner.example/files/b/" };

beforeEach(() => {
  vi.clearAllMocks();
  mockDiscoverInboxUri.mockResolvedValue(INBOX);
  mockListOutcomeNotifications.mockResolvedValue({
    approvals: [approval],
    rejections: [rejection],
  });
});

describe("useContactRejections", () => {
  it("loads approvals and rejections keyed by accessTo", async () => {
    const { result } = renderHook(() => useContactRejections(VIEWER));

    await waitFor(() => expect(result.current.fileRejections.size).toBe(1));
    expect(mockDiscoverInboxUri).toHaveBeenCalledWith(VIEWER, mockFetch);
    expect(result.current.fileRejections.get(rejection.accessTo)).toEqual(rejection);
    expect(result.current.fileApprovals.get(approval.accessTo)).toEqual(approval);
  });

  it("does not read the inbox when the viewer WebID is empty", async () => {
    const { result } = renderHook(() => useContactRejections(""));

    await Promise.resolve();
    expect(mockDiscoverInboxUri).not.toHaveBeenCalled();
    expect(result.current.fileRejections.size).toBe(0);
    expect(result.current.fileApprovals.size).toBe(0);
  });

  it("leaves the maps empty when the inbox is unreachable", async () => {
    mockListOutcomeNotifications.mockRejectedValue(new Error("inbox unreachable"));
    const { result } = renderHook(() => useContactRejections(VIEWER));

    await waitFor(() => expect(mockListOutcomeNotifications).toHaveBeenCalled());
    expect(result.current.fileRejections.size).toBe(0);
    expect(result.current.fileApprovals.size).toBe(0);
  });

  it("clears a target from both the rejections and approvals maps", async () => {
    const { result } = renderHook(() => useContactRejections(VIEWER));
    await waitFor(() => expect(result.current.fileRejections.size).toBe(1));

    act(() => result.current.handleClearRejection(rejection.accessTo));
    expect(result.current.fileRejections.has(rejection.accessTo)).toBe(false);

    act(() => result.current.handleClearRejection(approval.accessTo));
    expect(result.current.fileApprovals.has(approval.accessTo)).toBe(false);
  });

  it("leaves the maps untouched when clearing an unknown target", async () => {
    const { result } = renderHook(() => useContactRejections(VIEWER));
    await waitFor(() => expect(result.current.fileRejections.size).toBe(1));

    const rejectionsBefore = result.current.fileRejections;
    const approvalsBefore = result.current.fileApprovals;
    act(() => result.current.handleClearRejection("https://owner.example/files/unknown/"));

    expect(result.current.fileRejections).toBe(rejectionsBefore);
    expect(result.current.fileApprovals).toBe(approvalsBefore);
  });

  it("does not apply a load that resolves after unmount", async () => {
    let resolveList: (value: { approvals: typeof approval[]; rejections: typeof rejection[] }) => void = () => {};
    mockListOutcomeNotifications.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useContactRejections(VIEWER));
    await waitFor(() => expect(mockListOutcomeNotifications).toHaveBeenCalled());

    unmount();
    await act(async () => {
      resolveList({ approvals: [approval], rejections: [rejection] });
    });

    expect(result.current.fileRejections.size).toBe(0);
    expect(result.current.fileApprovals.size).toBe(0);
  });

  it("refetches outcomes when the window regains focus", async () => {
    renderHook(() => useContactRejections(VIEWER));
    await waitFor(() => expect(mockListOutcomeNotifications).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(mockListOutcomeNotifications).toHaveBeenCalledTimes(2));
  });

  it("ignores visibilitychange while the document is hidden", async () => {
    renderHook(() => useContactRejections(VIEWER));
    await waitFor(() => expect(mockListOutcomeNotifications).toHaveBeenCalledTimes(1));

    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mockListOutcomeNotifications).toHaveBeenCalledTimes(1);

    if (descriptor) Object.defineProperty(document, "visibilityState", descriptor);
    else Reflect.deleteProperty(document, "visibilityState");
  });
});
