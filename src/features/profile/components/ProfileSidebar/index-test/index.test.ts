import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/components/ProfileSidebar/index exports", () => {
  it("exports ProfileSidebar as a function", () => {
    expect(typeof Module.ProfileSidebar).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
