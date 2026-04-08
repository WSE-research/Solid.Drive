import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFileTypes } from '../useFileTypes-file/useFileTypes';
import { resetFileTypeCache } from "@/infrastructure/validation/fileTypeRegistry";

// Track cache state for mocking getFileTypesSync
let cachedTypes: any[] | null = null;

const FALLBACK_TYPES = [
  { uri: "http://schema.org/DigitalDocument", id: "DigitalDocument", label: "Document", description: "A digital document", parentTypes: [] },
];

// Mock the fileTypeRegistry module
vi.mock("@/infrastructure/validation/fileTypeRegistry", async () => {
  const actual = await vi.importActual<typeof import("@/infrastructure/validation/fileTypeRegistry")>(
    "@/infrastructure/validation/fileTypeRegistry"
  );
  return {
    ...actual,
    loadFileTypes: vi.fn(),
    getFileTypesSync: vi.fn(() => cachedTypes),
    getAllFileTypes: vi.fn(() => FALLBACK_TYPES),
    resetFileTypeCache: vi.fn(() => { cachedTypes = null; }),
  };
});

import { loadFileTypes, resetFileTypeCache } from "@/infrastructure/validation/fileTypeRegistry";

const mockLoadFileTypes = vi.mocked(loadFileTypes);

const MOCK_TYPES = [
  { uri: "http://schema.org/ImageObject", id: "ImageObject", label: "Image", description: "An image file", parentTypes: ["http://schema.org/MediaObject"] },
  { uri: "http://schema.org/VideoObject", id: "VideoObject", label: "Video", description: "A video file", parentTypes: ["http://schema.org/MediaObject"] },
];

describe("useFileTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedTypes = null;
    mockLoadFileTypes.mockResolvedValue(MOCK_TYPES);
  });

  it("returns loading state initially", () => {
    const { result } = renderHook(() => useFileTypes());
    expect(result.current.loading).toBe(true);
  });

  it("loads file types from TBox", async () => {
    const { result } = renderHook(() => useFileTypes());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.fileTypes).toEqual(MOCK_TYPES);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("provides fallback types while loading", () => {
    const { result } = renderHook(() => useFileTypes());

    // Should have fallback types immediately
    expect(result.current.fileTypes.length).toBeGreaterThan(0);
    expect(result.current.fileTypes.some((t) => t.id === "DigitalDocument")).toBe(true);
  });

  it("handles loading errors gracefully", async () => {
    mockLoadFileTypes.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFileTypes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    // Should still have fallback types
    expect(result.current.fileTypes.length).toBeGreaterThan(0);
  });

  it("passes custom tboxUri to loadFileTypes", async () => {
    const { result } = renderHook(() => useFileTypes("/custom/tbox.ttl"));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(mockLoadFileTypes).toHaveBeenCalledWith("/custom/tbox.ttl");
  });

  it("uses cached types on second render without re-fetching", async () => {
    // First render loads and caches
    mockLoadFileTypes.mockImplementation(async () => {
      // Simulate the real loadFileTypes populating the cache
      cachedTypes = MOCK_TYPES;
      return MOCK_TYPES;
    });

    const { result: first } = renderHook(() => useFileTypes());
    await waitFor(() => {
      expect(first.current.loaded).toBe(true);
    });

    mockLoadFileTypes.mockClear();

    // Second render should use cache (getFileTypesSync now returns cachedTypes)
    const { result: second } = renderHook(() => useFileTypes());
    expect(second.current.loaded).toBe(true);
    expect(second.current.loading).toBe(false);
    expect(second.current.fileTypes).toEqual(MOCK_TYPES);
    // loadFileTypes should not be called again
    expect(mockLoadFileTypes).not.toHaveBeenCalled();
  });

  it("handles non-Error rejection", async () => {
    mockLoadFileTypes.mockRejectedValue("string error");

    const { result } = renderHook(() => useFileTypes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load file types");
  });
});
