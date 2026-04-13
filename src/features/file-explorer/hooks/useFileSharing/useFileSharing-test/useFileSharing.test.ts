import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFileSharing } from '../useFileSharing-file/useFileSharing';
import * as aclManager from "@/infrastructure/wac/aclManager";

vi.mock("@/infrastructure/wac/aclManager");

const mockFetch = vi.fn();

describe("useFileSharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when containerUri is undefined", () => {
    const { result } = renderHook(() => useFileSharing(undefined, mockFetch));
    expect(result.current).toBe(false);
  });

  it("returns true when ACL has shared agents", async () => {
    vi.mocked(aclManager.discoverAclUri).mockResolvedValue("https://pod.example/files/doc/.acl");
    vi.mocked(aclManager.readAclAgents).mockResolvedValue(["https://bob.example/profile/card#me"]);

    const { result } = renderHook(() =>
      useFileSharing("https://pod.example/files/doc/", mockFetch)
    );

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false when ACL has no shared agents", async () => {
    vi.mocked(aclManager.discoverAclUri).mockResolvedValue("https://pod.example/files/doc/.acl");
    vi.mocked(aclManager.readAclAgents).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useFileSharing("https://pod.example/files/doc/", mockFetch)
    );

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("returns false when ACL discovery fails", async () => {
    vi.mocked(aclManager.discoverAclUri).mockRejectedValue(new Error("No ACL link header"));

    const { result } = renderHook(() =>
      useFileSharing("https://pod.example/files/doc/", mockFetch)
    );

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("ignores stale results after containerUri changes", async () => {
    vi.mocked(aclManager.discoverAclUri).mockResolvedValue("https://pod.example/files/doc/.acl");
    vi.mocked(aclManager.readAclAgents).mockResolvedValue(["https://bob.example/profile/card#me"]);

    const { result, rerender } = renderHook<boolean, { uri: string | undefined }>(
      ({ uri }) => useFileSharing(uri, mockFetch),
      { initialProps: { uri: "https://pod.example/files/doc/" } }
    );

    rerender({ uri: undefined });
    await waitFor(() => expect(result.current).toBe(false));
  });
});
