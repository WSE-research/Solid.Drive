import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/SharedWithMeSection/index exports", () => {
  it("exports SharedWithMeSection as a function", () => {
    expect(typeof Module.SharedWithMeSection).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
