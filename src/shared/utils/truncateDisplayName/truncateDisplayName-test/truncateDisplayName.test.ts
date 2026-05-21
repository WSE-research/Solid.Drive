import { describe, it, expect } from "vitest";
import { MAX_DISPLAY_NAME_LENGTH } from "@/config";
import { truncateDisplayName } from "../truncateDisplayName-file/truncateDisplayName";

describe("truncateDisplayName", () => {
  it("returns the name unchanged when within the limit", () => {
    expect(truncateDisplayName("Alice")).toBe("Alice");
  });

  it("returns the name unchanged at exactly the limit", () => {
    const exact = "a".repeat(MAX_DISPLAY_NAME_LENGTH);
    expect(truncateDisplayName(exact)).toBe(exact);
  });

  it("truncates and appends an ellipsis beyond the limit", () => {
    const long = "a".repeat(MAX_DISPLAY_NAME_LENGTH + 5);
    const result = truncateDisplayName(long);
    expect(result.length).toBe(MAX_DISPLAY_NAME_LENGTH + 1);
    expect(result.endsWith("…")).toBe(true);
  });
});
