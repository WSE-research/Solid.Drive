import { describe, it, expect } from "vitest";
import { containerSlugFor } from "../containerSlug-file/containerSlug";

describe("containerSlugFor", () => {
  it("lower-cases and keeps dots", () => {
    expect(containerSlugFor("Report.PDF")).toBe("report.pdf");
  });

  it("collapses each run of unsupported characters to a single dash", () => {
    expect(containerSlugFor("my  weird__name!!.txt")).toBe("my-weird-name-.txt");
  });

  it("maps distinct names onto the same slug", () => {
    // The property the de-duplication depends on: comparing file names would
    // let these two through, and the second upload would overwrite the first.
    expect(containerSlugFor("a b.txt")).toBe(containerSlugFor("a-b.txt"));
  });

  it("is idempotent for an already-slug-shaped name", () => {
    expect(containerSlugFor("already-a-slug.txt")).toBe("already-a-slug.txt");
  });

  it("handles a name with no usable characters", () => {
    expect(containerSlugFor("***")).toBe("-");
  });
});
