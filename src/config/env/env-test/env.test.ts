import { describe, it, expect } from "vitest";
import { ENV } from '../env-file/env';

describe("ENV", () => {
  it("exposes a mode string matching the test environment", () => {
    expect(ENV.mode).toBe("test");
  });

  it("dev is true in test mode", () => {
    expect(ENV.dev).toBe(true);
  });

  it("prod is false in test mode", () => {
    expect(ENV.prod).toBe(false);
  });

  it("dev and prod are mutually exclusive", () => {
    expect(ENV.dev && ENV.prod).toBe(false);
  });

  it("baseUrl matches the configured base path", () => {
    expect(ENV.baseUrl).toBe("/solid-hello-world-frontend-react/");
  });
});
