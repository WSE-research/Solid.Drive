import { describe, it, expect } from "vitest";
import * as Module from "..";

describe("features/file-explorer/components/FileUpload/index exports", () => {
  it("exports FileUpload as a function", () => {
    expect(typeof Module.FileUpload).toBe("function");
  });

  it("exports exactly 1 item", () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
