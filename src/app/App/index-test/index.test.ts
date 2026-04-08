import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("app/App/index exports", () => {
  it("exports App as the default export function", () => {
    expect(typeof (Module as Record<string, unknown>).default).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
