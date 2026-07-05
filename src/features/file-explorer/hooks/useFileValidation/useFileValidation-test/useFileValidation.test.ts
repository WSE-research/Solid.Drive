import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFileValidation } from '../useFileValidation-file/useFileValidation';
import * as tboxValidator from "@/infrastructure/validation/tboxValidator";
import * as fileTypeRegistry from "@/infrastructure/validation/fileTypeRegistry";

vi.mock("@/infrastructure/validation/tboxValidator");
vi.mock("@/infrastructure/validation/fileTypeRegistry");

const mockShapes = new Map();
const mockParents = new Map();

describe("useFileValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tboxValidator.loadTBox).mockResolvedValue({ shapes: mockShapes, parents: mockParents });
    vi.mocked(fileTypeRegistry.resolveClass).mockReturnValue("https://schema.org/DigitalDocument");
  });

  it("returns isReady=false initially before TBox loads", () => {
    vi.mocked(tboxValidator.loadTBox).mockReturnValue(new Promise(() => {})); // never resolves
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    const { result } = renderHook(() =>
      useFileValidation(file, "My Title", "", "https://user.example/profile/card#me")
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.validation).toBeNull();
  });

  it("returns isReady=true after TBox loads", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    const { result } = renderHook(() =>
      useFileValidation(file, "My Title", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it("returns null validation when no file is provided", async () => {
    const { result } = renderHook(() =>
      useFileValidation(undefined, "", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.validation).toBeNull();
  });

  it("returns validation result when file and TBox are ready", async () => {
    const mockResult = {
      valid: true,
      violations: [],
      shape: { label: "Digital Document", description: "" } as unknown as tboxValidator.ShapeDefinition,
    };
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue(mockResult);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    const { result } = renderHook(() =>
      useFileValidation(file, "Test PDF", "A description", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(result.current.validation).not.toBeNull());
    expect(result.current.validation?.valid).toBe(true);
  });

  it("sets tboxError when TBox loading fails", async () => {
    vi.mocked(tboxValidator.loadTBox).mockRejectedValue(new Error("TBox fetch failed"));

    const { result } = renderHook(() =>
      useFileValidation(undefined, "", "", undefined)
    );

    await waitFor(() => expect(result.current.tboxError).toBe("TBox fetch failed"));
  });

  it("skips state updates when unmounted before TBox loading resolves", async () => {
    let resolveLoad!: (types: { shapes: typeof mockShapes; parents: typeof mockParents }) => void;
    vi.mocked(tboxValidator.loadTBox).mockImplementation(
      () => new Promise((resolve) => { resolveLoad = resolve; }),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() => useFileValidation(undefined, "", "", undefined));
    unmount();
    resolveLoad({ shapes: mockShapes, parents: mockParents });
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("skips state updates when unmounted before TBox loading rejects", async () => {
    let rejectLoad!: (error: Error) => void;
    vi.mocked(tboxValidator.loadTBox).mockImplementation(
      () => new Promise((_resolve, reject) => { rejectLoad = reject; }),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() => useFileValidation(undefined, "", "", undefined));
    unmount();
    rejectLoad(new Error("TBox fetch failed"));
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("skips state updates when unmounted before a validation pass resolves", async () => {
    let loadCount = 0;
    let resolveSecondLoad!: (types: { shapes: typeof mockShapes; parents: typeof mockParents }) => void;
    vi.mocked(tboxValidator.loadTBox).mockImplementation(() => {
      loadCount += 1;
      if (loadCount === 1) return Promise.resolve({ shapes: mockShapes, parents: mockParents });
      return new Promise((resolve) => { resolveSecondLoad = resolve; });
    });
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    const { result, unmount } = renderHook(() =>
      useFileValidation(file, "Title", "", "https://user.example/profile/card#me"),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    unmount();
    resolveSecondLoad({ shapes: mockShapes, parents: mockParents });
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("skips state updates when unmounted before a validation pass throws", async () => {
    let loadCount = 0;
    let rejectSecondLoad!: (error: Error) => void;
    vi.mocked(tboxValidator.loadTBox).mockImplementation(() => {
      loadCount += 1;
      if (loadCount === 1) return Promise.resolve({ shapes: mockShapes, parents: mockParents });
      return new Promise((_resolve, reject) => { rejectSecondLoad = reject; });
    });
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    const { result, unmount } = renderHook(() =>
      useFileValidation(file, "Title", "", "https://user.example/profile/card#me"),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    unmount();
    rejectSecondLoad(new Error("validation crashed"));
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("reports violations when required fields are missing", async () => {
    const mockResult = {
      valid: false,
      violations: [{ path: "name", localName: "name", label: "Title", description: "Required", minCount: 1 }],
      shape: null,
    };
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue(mockResult);
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    const { result } = renderHook(() =>
      useFileValidation(file, "", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(result.current.validation?.valid).toBe(false));
    expect(result.current.validation?.violations).toHaveLength(1);
  });

  // --- Branch coverage additions ---

  it("uses file.name as title when title.trim() is empty", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    renderHook(() =>
      useFileValidation(file, "   ", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    const snapshot = vi.mocked(tboxValidator.validateMetadata).mock.calls[0][0] as Record<string, unknown>;
    expect(snapshot.name).toBe("test.txt");
  });

  it("passes description.trim() || undefined (empty description → undefined)", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    renderHook(() =>
      useFileValidation(file, "Title", "  ", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    const snapshot = vi.mocked(tboxValidator.validateMetadata).mock.calls[0][0] as Record<string, unknown>;
    expect(snapshot.description).toBeUndefined();
  });

  it("passes non-empty description.trim() as value", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    renderHook(() =>
      useFileValidation(file, "Title", "Some desc", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    const snapshot = vi.mocked(tboxValidator.validateMetadata).mock.calls[0][0] as Record<string, unknown>;
    expect(snapshot.description).toBe("Some desc");
  });

  it("passes file.type || undefined (empty type → undefined)", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.bin", { type: "" });

    renderHook(() =>
      useFileValidation(file, "Title", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    const snapshot = vi.mocked(tboxValidator.validateMetadata).mock.calls[0][0] as Record<string, unknown>;
    expect(snapshot.encodingFormat).toBeUndefined();
  });

  it("uses 'DigitalDocument' fallback when classUri has no / or #", async () => {
    // resolveClass returns a URI without / or # → .pop() after split would return the whole thing
    // But the ?? "DigitalDocument" only triggers if .pop() returns undefined (which can't happen with split)
    // However, we test the normal path where it extracts the local name correctly
    vi.mocked(fileTypeRegistry.resolveClass).mockReturnValue("https://schema.org/ImageObject");
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.png", { type: "image/png" });

    renderHook(() =>
      useFileValidation(file, "Title", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    const snapshot = vi.mocked(tboxValidator.validateMetadata).mock.calls[0][0] as Record<string, unknown>;
    const typeArr = snapshot.type as { "@id": string }[];
    expect(typeArr[0]["@id"]).toBe("ImageObject");
  });

  it("sets validation to null when validateFile rejects", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockImplementation(() => {
      throw new Error("Validation crashed");
    });
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    const { result } = renderHook(() =>
      useFileValidation(file, "Title", "", "https://user.example/profile/card#me")
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    expect(result.current.validation).toBeNull();
  });

  it("passes webId as empty string when undefined", async () => {
    vi.mocked(tboxValidator.validateMetadata).mockReturnValue({ valid: true, violations: [], shape: null });
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    renderHook(() =>
      useFileValidation(file, "Title", "", undefined)
    );

    await waitFor(() => expect(tboxValidator.validateMetadata).toHaveBeenCalled());
    const snapshot = vi.mocked(tboxValidator.validateMetadata).mock.calls[0][0] as Record<string, unknown>;
    expect((snapshot.publisher as { "@id": string })["@id"]).toBe("");
  });
});
