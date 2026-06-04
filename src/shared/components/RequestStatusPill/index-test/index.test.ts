import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("shared/components/RequestStatusPill/index exports", () => {
  it("exports RequestStatusPill as a function", () => {
    expect(typeof Module.RequestStatusPill).toBe("function");
  });

  it("exports exactly 1 runtime item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
