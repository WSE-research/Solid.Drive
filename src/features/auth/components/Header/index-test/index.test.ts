import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/auth/components/Header/index exports", () => {
  it("exports Header as a function", () => {
    expect(typeof Module.Header).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
