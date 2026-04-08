import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("shared/components/Toast/index exports", () => {
  it("exports Toast as a function", () => {
    expect(typeof Module.Toast).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
