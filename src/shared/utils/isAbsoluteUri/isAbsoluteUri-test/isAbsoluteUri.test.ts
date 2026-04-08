import { describe, it, expect } from "vitest";
import { isAbsoluteUri } from '../isAbsoluteUri-file/isAbsoluteUri';

describe("isAbsoluteUri", () => {
  it("returns true for an https URI", () => {
    expect(isAbsoluteUri("https://example.com/resource")).toBe(true);
  });

  it("returns true for an http URI", () => {
    expect(isAbsoluteUri("http://example.com/resource")).toBe(true);
  });

  it("returns false for a relative path", () => {
    expect(isAbsoluteUri("/relative/path")).toBe(false);
  });

  it("returns false for a bare name", () => {
    expect(isAbsoluteUri("justAName")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isAbsoluteUri("")).toBe(false);
  });

  it("returns false for ftp:// scheme", () => {
    expect(isAbsoluteUri("ftp://files.example.com")).toBe(false);
  });

  it("returns false for a string that contains https but does not start with it", () => {
    expect(isAbsoluteUri("not-https://example.com")).toBe(false);
  });
});
