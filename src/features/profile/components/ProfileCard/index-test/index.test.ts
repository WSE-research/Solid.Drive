import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/components/ProfileCard/index exports", () => {
  it("exports ProfileCard as a function", () => {
    expect(typeof Module.ProfileCard).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
