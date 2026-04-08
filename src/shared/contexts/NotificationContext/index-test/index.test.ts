import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("shared/contexts/NotificationContext/index exports", () => {
  const expectedExports = ["useNotifications", "NotificationProvider"] as const;

  it.each(expectedExports)("exports %s as a function", (name) => {
    expect(typeof (Module as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 2 items", () => {
    expect(Object.keys(Module)).toHaveLength(2);
  });
});
