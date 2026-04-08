import { describe, it, expect } from "vitest";
import * as EnvModule from "..";

describe("config/env/index exports", () => {
  it("exports ENV as an object", () => {
    expect(EnvModule.ENV).toBeDefined();
    expect(typeof EnvModule.ENV).toBe("object");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(EnvModule)).toHaveLength(1);
  });
});
