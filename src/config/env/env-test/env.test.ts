import { describe, it, expect, afterEach, vi } from "vitest";
import { ENV, UPLOAD_CONCURRENCY_DEFAULT } from '../env-file/env';

/**
 * Re-imports the module with `VITE_UPLOAD_CONCURRENCY` set to `raw`, because
 * `ENV` is frozen at module-evaluation time — the only way to observe a
 * different environment is to evaluate it again.
 */
async function envWithConcurrency(raw: string | undefined) {
  vi.stubEnv("VITE_UPLOAD_CONCURRENCY", raw);
  vi.resetModules();
  return (await import("../env-file/env")).ENV;
}

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

  it("exposes baseUrl as a string ending in a trailing slash", () => {
    expect(typeof ENV.baseUrl).toBe("string");
    expect(ENV.baseUrl.endsWith("/")).toBe(true);
  });
});

describe("ENV.uploadConcurrency", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to the default when unset", async () => {
    const env = await envWithConcurrency(undefined);
    expect(env.uploadConcurrency).toBe(UPLOAD_CONCURRENCY_DEFAULT);
  });

  it("uses a configured positive integer", async () => {
    const env = await envWithConcurrency("8");
    expect(env.uploadConcurrency).toBe(8);
  });

  // A deployment typo must not stop the app from starting, so every unusable
  // value degrades to the default rather than throwing.
  it.each([
    ["not a number", "abc"],
    ["zero", "0"],
    ["negative", "-2"],
    ["empty", ""],
  ])("falls back to the default for %s", async (_label, raw) => {
    const env = await envWithConcurrency(raw);
    expect(env.uploadConcurrency).toBe(UPLOAD_CONCURRENCY_DEFAULT);
  });

  it("truncates a fractional value rather than rejecting it", async () => {
    const env = await envWithConcurrency("3.7");
    expect(env.uploadConcurrency).toBe(3);
  });
});
