import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/FolderEntry/index exports", () => {
  it("exports FolderEntry as a function", () => {
    expect(typeof Module.FolderEntry).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
