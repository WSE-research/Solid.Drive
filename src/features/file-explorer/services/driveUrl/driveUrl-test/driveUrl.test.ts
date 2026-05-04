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

  it("documents the conventional search parameter name", () => {
    expect(DRIVE_FOLDER_SEARCH_PARAM).toBe("folder");
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
