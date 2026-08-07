import { describe, it, expect } from "vitest";
import * as EnvModule from "..";

describe("config/env/index exports", () => {
  it("exports ENV as an object", () => {
    expect(EnvModule.ENV).toBeDefined();
    expect(typeof EnvModule.ENV).toBe("object");
  });

  it("exports the upload concurrency default as a positive integer", () => {
    expect(Number.isInteger(EnvModule.UPLOAD_CONCURRENCY_DEFAULT)).toBe(true);
    expect(EnvModule.UPLOAD_CONCURRENCY_DEFAULT).toBeGreaterThan(0);
  });

  it("exports exactly these items", () => {
    expect(Object.keys(EnvModule).sort()).toEqual(["ENV", "UPLOAD_CONCURRENCY_DEFAULT"]);
  });
});
