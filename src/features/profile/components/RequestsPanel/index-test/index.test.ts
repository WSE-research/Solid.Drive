import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/components/RequestsPanel/index exports", () => {
  it("exports RequestsPanel as a function", () => {
    expect(typeof Module.RequestsPanel).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
