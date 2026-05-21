import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

let mockResource: Record<string, unknown> = { isLoading: () => false };
let mockProfile: Record<string, unknown> | null = null;
const useResourceSpy = vi.fn();

vi.mock("@ldo/solid-react", () => ({
  useResource: (uri: string) => {
    useResourceSpy(uri);
    return mockResource;
  },
  useSubject: () => mockProfile,
}));

vi.mock("@/.ldo/solidProfile.shapeTypes", () => ({
  SolidProfileShapeType: "SolidProfileShapeType",
}));

vi.mock("@/infrastructure/solid/resourceGuards", () => ({
  isLoadable: (res: unknown) =>
    res != null && typeof (res as Record<string, unknown>).isLoading === "function",
}));

import { useRequesterProfile } from "../useRequesterProfile-file/useRequesterProfile";

describe("useRequesterProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResource = { isLoading: () => false };
    mockProfile = null;
  });

  it("strips the hash fragment when subscribing to the profile document", () => {
    renderHook(() => useRequesterProfile("https://alice.example/profile/card#me"));
    expect(useResourceSpy).toHaveBeenCalledWith("https://alice.example/profile/card");
  });

  it("returns profileLoading=true while the document is loading", () => {
    mockResource = { isLoading: () => true };
    const { result } = renderHook(() =>
      useRequesterProfile("https://alice.example/profile/card#me"),
    );
    expect(result.current.profileLoading).toBe(true);
  });

  it("returns a WebID-derived display name when profile is empty", () => {
    const { result } = renderHook(() =>
      useRequesterProfile("https://alice.solidcommunity.net/profile/card#me"),
    );
    expect(result.current.displayName).toBe("alice");
  });

  it("returns the profile name and avatar when both are present", () => {
    mockProfile = { name: "Alice Doe", img: { "@id": "https://example/a.jpg" } };
    const { result } = renderHook(() =>
      useRequesterProfile("https://alice.example/profile/card#me"),
    );
    expect(result.current.displayName).toBe("Alice Doe");
    expect(result.current.avatarUrl).toBe("https://example/a.jpg");
  });

  it("returns avatarUrl undefined when the profile has no image", () => {
    mockProfile = { name: "Alice Doe" };
    const { result } = renderHook(() =>
      useRequesterProfile("https://alice.example/profile/card#me"),
    );
    expect(result.current.avatarUrl).toBeUndefined();
  });
});
