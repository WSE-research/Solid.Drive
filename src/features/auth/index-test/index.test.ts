import { describe, it, expect } from "vitest";
import * as AuthModule from "..";

describe("features/auth/index exports", () => {
  const expectedExports = ["Header", "LandingPage", "LanguageSwitcher", "useAuth"] as const;

  it.each(expectedExports)("exports %s as a function", (name) => {
    expect(typeof (AuthModule as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 4 items", () => {
    expect(Object.keys(AuthModule)).toHaveLength(4);
  });
});
