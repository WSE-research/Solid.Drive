import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/hooks/useRequesterProfile/index exports", () => {
  it("exports useRequesterProfile as a function", () => {
    expect(typeof Module.useRequesterProfile).toBe("function");
  });

  it("exports exactly 1 runtime value", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
