import { describe, it, expect } from "vitest";
import * as Utils from "..";

describe("shared/utils/index exports", () => {
  const expectedFunctions = [
    "formatBytes",
    "isAbsoluteUri",
    "getInitial",
    "getProfileDisplayName",
    "getWebIdFallbackName",
  ] as const;

  it.each(expectedFunctions)("exports %s as a function", (name) => {
    expect(typeof (Utils as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 5 items", () => {
    expect(Object.keys(Utils)).toHaveLength(5);
  });
});
