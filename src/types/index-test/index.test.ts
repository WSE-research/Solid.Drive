import { describe, it, expect } from "vitest";

// types/index.ts only re-exports TypeScript type aliases — there are no runtime
// values to assert on. This test verifies the module is importable without error.
describe("types/index", () => {
  it("imports without throwing", async () => {
    await expect(import("..")).resolves.not.toThrow();
  });
});
