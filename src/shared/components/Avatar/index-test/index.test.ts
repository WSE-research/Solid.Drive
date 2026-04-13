import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("shared/components/Avatar/index exports", () => {
  it("exports Avatar as a function", () => {
    expect(typeof Module.Avatar).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
