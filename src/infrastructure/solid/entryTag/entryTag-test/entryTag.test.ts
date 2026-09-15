import { describe, it, expect } from "vitest";
import { generateEntryTag, isValidEntryTag } from "../entryTag-file/entryTag";

describe("generateEntryTag", () => {
  it("returns a value that passes validation", () => {
    expect(isValidEntryTag(generateEntryTag())).toBe(true);
  });

  it("returns a different value on every call", () => {
    expect(generateEntryTag()).not.toBe(generateEntryTag());
  });
});

describe("isValidEntryTag", () => {
  it.each([
    ["a lowercase UUID", "3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    ["an uppercase UUID", "3FA85F64-5717-4562-B3FC-2C963F66AFA6"],
    ["a mixed-case UUID", "3fA85F64-5717-4562-b3FC-2c963F66Afa6"],
  ])("accepts %s", (_label, value) => {
    expect(isValidEntryTag(value)).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["a UUID with no hyphens", "3fa85f6457174562b3fc2c963f66afa6"],
    ["a UUID that's too short", "3fa85f64-5717-4562-b3fc-2c963f66af"],
    ["a UUID containing a non-hex character", "3fa85g64-5717-4562-b3fc-2c963f66afa6"],
    ["a valid UUID with extra characters appended", "3fa85f64-5717-4562-b3fc-2c963f66afa6-extra"],
    ["a valid UUID with unrelated punctuation appended", "3fa85f64-5717-4562-b3fc-2c963f66afa6> . <x> a <y> #"],
  ])("rejects %s", (_label, value) => {
    expect(isValidEntryTag(value)).toBe(false);
  });
});
