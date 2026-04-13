import { describe, it, expect } from "vitest";
import * as SharingModule from "..";

describe("features/sharing/index exports", () => {
  it("exports useAclManager as a function", () => {
    expect(typeof SharingModule.useAclManager).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(SharingModule)).toHaveLength(1);
  });
});
