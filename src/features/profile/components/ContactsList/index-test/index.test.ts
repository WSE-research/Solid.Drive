import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/profile/components/ContactsList/index exports", () => {
  it("exports ContactsList as a function", () => {
    expect(typeof Module.ContactsList).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
