import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/utils/buildRequestDescription/index exports", () => {
  it("exports buildRequestDescription, getResourceLabel, getTypeLabel", () => {
    expect(typeof Module.buildRequestDescription).toBe("function");
    expect(typeof Module.getResourceLabel).toBe("function");
    expect(typeof Module.getTypeLabel).toBe("function");
  });

  it("exports exactly 3 runtime values", () => {
    expect(Object.keys(Module)).toHaveLength(3);
  });
});
