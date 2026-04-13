import { describe, it, expect } from "vitest";
import { getInitial } from '../getInitial-file/getInitial';

describe("getInitial", () => {
  it("returns the uppercase first character of a name", () => {
    expect(getInitial("alice")).toBe("A");
  });

  it("uppercases an already-uppercase character", () => {
    expect(getInitial("Bob")).toBe("B");
  });

  it("returns the uppercased character when input is a single letter", () => {
    expect(getInitial("x")).toBe("X");
  });

  it("returns the default fallback '?' for an empty string", () => {
    expect(getInitial("")).toBe("?");
  });

  it("returns a custom fallback for an empty string", () => {
    expect(getInitial("", "#")).toBe("#");
  });

  it("uses only the first character, ignoring the rest", () => {
    expect(getInitial("Carol Smith")).toBe("C");
  });
});
