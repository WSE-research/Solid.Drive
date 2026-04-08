import { describe, it, expect } from "vitest";
import { ENV } from '../env-file/env';

describe("ENV", () => {
  it("exposes a mode string", () => {
    expect(typeof ENV.mode).toBe("string");
  });

  it("exposes a boolean dev flag", () => {
    expect(typeof ENV.dev).toBe("boolean");
  });

  it("exposes a boolean prod flag", () => {
    expect(typeof ENV.prod).toBe("boolean");
  });

  it("dev and prod are mutually exclusive", () => {
    expect(ENV.dev && ENV.prod).toBe(false);
  });
});
