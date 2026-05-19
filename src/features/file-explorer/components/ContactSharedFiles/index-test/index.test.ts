import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/ContactSharedFiles/index exports", () => {
  it("exports ContactSharedFiles as a function", () => {
    expect(typeof Module.ContactSharedFiles).toBe("function");
  });

  it("exports exactly 1 runtime item (types are erased)", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
