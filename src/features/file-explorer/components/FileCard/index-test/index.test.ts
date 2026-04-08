import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/FileCard/index exports", () => {
  it("exports FileCard as a function", () => {
    expect(typeof Module.FileCard).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
