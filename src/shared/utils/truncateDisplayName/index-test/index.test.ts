import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("shared/utils/truncateDisplayName/index exports", () => {
  it("exports truncateDisplayName as a function", () => {
    expect(typeof Module.truncateDisplayName).toBe("function");
  });

  it("exports exactly 1 runtime value", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
