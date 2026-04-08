import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/components/ContactRow/index exports", () => {
  it("exports ContactRow as a function", () => {
    expect(typeof Module.ContactRow).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
