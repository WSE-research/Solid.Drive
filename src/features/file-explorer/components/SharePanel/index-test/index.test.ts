import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/SharePanel/index exports", () => {
  it("exports SharePanel as a function", () => {
    expect(typeof Module.SharePanel).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
