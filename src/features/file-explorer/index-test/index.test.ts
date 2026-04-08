import { describe, it, expect } from "vitest";
import * as FileExplorerModule from "..";

describe("features/file-explorer/index exports", () => {
  const expectedComponents = [
    "FileExplorer",
    "FileCard",
    "FileUpload",
    "FolderEntry",
    "SharedWithMeSection",
  ] as const;

  const expectedHooks = [
    "usePodDiscovery",
    "useNavigation",
    "useFileUpload",
    "useFilePreview",
    "useSharedCatalog",
    "useFileTypes",
  ] as const;

  it.each(expectedComponents)("exports component %s as a function", (name) => {
    expect(typeof (FileExplorerModule as Record<string, unknown>)[name]).toBe("function");
  });

  it.each(expectedHooks)("exports hook %s as a function", (name) => {
    expect(typeof (FileExplorerModule as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports isVisibleLeaf as a function", () => {
    expect(typeof FileExplorerModule.isVisibleLeaf).toBe("function");
  });

  it("exports exactly 12 items", () => {
    expect(Object.keys(FileExplorerModule)).toHaveLength(12);
  });
});
