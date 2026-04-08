import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/TypeFolder/index exports", () => {
  it("exports TypeFolder as a function", () => {
    expect(typeof Module.TypeFolder).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
