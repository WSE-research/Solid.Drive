import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("shared/components/ErrorBoundary/index exports", () => {
  it("exports ErrorBoundary as a function", () => {
    expect(typeof Module.ErrorBoundary).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
