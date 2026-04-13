import { describe, it, expect } from "vitest";
import * as ProfileModule from "..";

describe("features/profile/index exports", () => {
  const expectedFunctions = [
    "ProfileSidebar",
    "RequestsPanel",
    "useProfile",
    "useContacts",
    "useAccessRequests",
  ] as const;

  it.each(expectedFunctions)("exports %s as a function", (name) => {
    expect(typeof (ProfileModule as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 5 items", () => {
    expect(Object.keys(ProfileModule)).toHaveLength(5);
  });
});
