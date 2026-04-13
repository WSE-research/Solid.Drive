import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/FileExplorer/index exports", () => {
  const expectedExports = ["FileExplorer", "DriveFileList"] as const;

  it.each(expectedExports)("exports %s as a function", (name) => {
    expect(typeof (Module as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 2 items", () => {
    expect(Object.keys(Module)).toHaveLength(2);
  });
});
