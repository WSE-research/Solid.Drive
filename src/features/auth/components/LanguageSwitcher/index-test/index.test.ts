import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/auth/components/LanguageSwitcher/index exports", () => {
  it("exports LanguageSwitcher as a function", () => {
    expect(typeof Module.LanguageSwitcher).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
