import { describe, it, expect } from "vitest";
import * as SharedComponents from "..";

describe("shared/components/index exports", () => {
  const expectedComponents = ["Avatar", "ErrorBoundary", "RequestStatusPill", "Toast"] as const;

  it.each(expectedComponents)("exports %s as a function", (name) => {
    expect(typeof (SharedComponents as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 4 items", () => {
    expect(Object.keys(SharedComponents)).toHaveLength(4);
  });
});
