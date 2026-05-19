import { describe, it, expect } from "vitest";
import {
  buildDriveBreadcrumbs,
  decodeDriveFolderSearchParam,
  DRIVE_FOLDER_SEARCH_PARAM,
  encodeDriveFolderSearchValue,
  isContainerUnderStorage,
  normalizeContainerUri,
} from "../driveUrl-file/driveUrl";

describe("normalizeContainerUri", () => {
  it("adds a trailing slash", () => {
    expect(normalizeContainerUri("https://pod.example/x")).toBe("https://pod.example/x/");
  });

  it("keeps a single trailing slash", () => {
    expect(normalizeContainerUri("https://pod.example/x/")).toBe("https://pod.example/x/");
  });
});

describe("isContainerUnderStorage", () => {
  it("allows the storage root", () => {
    expect(isContainerUnderStorage("https://pod.example/", "https://pod.example/")).toBe(true);
  });

  it("allows descendants under the storage root", () => {
    expect(
      isContainerUnderStorage(
        "https://pod.example/my-app/data/",
        "https://pod.example/"
      )
    ).toBe(true);
  });

  it("rejects URIs outside the storage tree", () => {
    expect(
      isContainerUnderStorage("https://other.example/foo/", "https://pod.example/")
    ).toBe(false);
  });
});

describe("decodeDriveFolderSearchParam / encodeDriveFolderSearchValue", () => {
  it("round-trips Solid container URIs", () => {
    const uri = "https://pod.example/my-solid-app/photos/hello world/";
    const raw = encodeDriveFolderSearchValue(uri);
    expect(decodeDriveFolderSearchParam(raw)).toBe(uri);
  });

  it("accepts bare https URLs passed through without decoding", () => {
    expect(decodeDriveFolderSearchParam("https://pod.example/foo/")).toBe(
      "https://pod.example/foo/"
    );
  });

  it("returns undefined for null input", () => {
    expect(decodeDriveFolderSearchParam(null)).toBeUndefined();
  });

  it("returns undefined for whitespace-only input", () => {
    expect(decodeDriveFolderSearchParam("   ")).toBeUndefined();
  });

  it("returns undefined for non-http strings", () => {
    expect(decodeDriveFolderSearchParam("file:///etc/passwd")).toBeUndefined();
  });

  it("returns undefined when the decoded value is not a parseable URL", () => {
    expect(decodeDriveFolderSearchParam("https://[bad")).toBeUndefined();
  });

  it("documents the conventional search parameter name", () => {
    expect(DRIVE_FOLDER_SEARCH_PARAM).toBe("folder");
  });

  it("returns undefined for null input", () => {
    expect(decodeDriveFolderSearchParam(null)).toBeUndefined();
  });

  it("returns undefined for whitespace-only input", () => {
    expect(decodeDriveFolderSearchParam("   ")).toBeUndefined();
  });

  it("returns undefined for inputs that decode to a non-http(s) string", () => {
    expect(decodeDriveFolderSearchParam("ftp%3A%2F%2Fx")).toBeUndefined();
  });

  it("returns undefined when the decoded value is not a parseable URL", () => {
    // Starts with "http" so it gets through the prefix check but is not a
    // valid URL (no host).
    expect(decodeDriveFolderSearchParam("http://")).toBeUndefined();
  });
});

describe("buildDriveBreadcrumbs", () => {
  it("builds only the storage root when folder equals storage", () => {
    const crumbs = buildDriveBreadcrumbs(
      "https://pod.example/",
      "https://pod.example/",
      "My Pod"
    );
    expect(crumbs).toEqual([
      { label: "My Pod", uri: "https://pod.example/" },
    ]);
  });

  it("returns only the storage root crumb when folder is not under storage", () => {
    const crumbs = buildDriveBreadcrumbs(
      "https://other.example/somewhere/",
      "https://pod.example/",
      "My Pod"
    );
    expect(crumbs).toEqual([
      { label: "My Pod", uri: "https://pod.example/" },
    ]);
  });

  it("walks intermediate path segments under the storage root", () => {
    const crumbs = buildDriveBreadcrumbs(
      "https://pod.example/my-solid-app/photos/",
      "https://pod.example/",
      "My Pod"
    );
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toMatchObject({
      label: "My Pod",
      uri: "https://pod.example/",
    });
    expect(crumbs[1]).toMatchObject({
      label: "my-solid-app",
      uri: "https://pod.example/my-solid-app/",
    });
    expect(crumbs[2]).toMatchObject({
      label: "photos",
      uri: "https://pod.example/my-solid-app/photos/",
    });
  });
});
