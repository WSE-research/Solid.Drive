import { describe, it, expect } from "vitest";
import { buildFolderPath, FolderPathError } from "../folderPath-file/folderPath";
import { FOLDER_CLASS_URI } from "@/infrastructure/solid/catalog";
import type { FolderIndex, FolderNode } from "@/types";

const STORAGE_ROOT = "https://pod.example/";
const LEGACY_CLASS_URI = "http://www.w3.org/ns/ldp#Container";

function node(partial: Omit<FolderNode, "conformsTo"> & { conformsTo?: string }): FolderNode {
  return { conformsTo: FOLDER_CLASS_URI, ...partial };
}

function indexOf(...nodes: FolderNode[]): FolderIndex {
  return new Map(nodes.map((entry) => [entry.uri, entry]));
}

describe("buildFolderPath", () => {
  it("returns only the root crumb when folderUri is the storage root", () => {
    const index = indexOf(node({ uri: STORAGE_ROOT, title: "", parentUri: "" }));
    const crumbs = buildFolderPath(STORAGE_ROOT, index, STORAGE_ROOT, "My Pod");
    expect(crumbs).toEqual([{ label: "My Pod", uri: STORAGE_ROOT }]);
  });

  it("walks a three-level chain up to the root, root-first", () => {
    const photos = "https://pod.example/my-solid-app/photos/";
    const app = "https://pod.example/my-solid-app/";
    const index = indexOf(
      node({ uri: STORAGE_ROOT, title: "", parentUri: "" }),
      node({ uri: app, title: "my-solid-app", parentUri: STORAGE_ROOT }),
      node({ uri: photos, title: "Photos", parentUri: app })
    );
    const crumbs = buildFolderPath(photos, index, STORAGE_ROOT, "My Pod");
    expect(crumbs).toEqual([
      { label: "My Pod", uri: STORAGE_ROOT },
      { label: "my-solid-app", uri: app },
      { label: "Photos", uri: photos },
    ]);
  });

  it("falls back to rootLabel when the root entry has no title", () => {
    const index = indexOf(node({ uri: STORAGE_ROOT, title: "", parentUri: "" }));
    const crumbs = buildFolderPath(STORAGE_ROOT, index, STORAGE_ROOT, "My Pod");
    expect(crumbs[0].label).toBe("My Pod");
  });

  it("keeps the root's own title when it has one", () => {
    const index = indexOf(node({ uri: STORAGE_ROOT, title: "Alice's Pod", parentUri: "" }));
    const crumbs = buildFolderPath(STORAGE_ROOT, index, STORAGE_ROOT, "My Pod");
    expect(crumbs[0].label).toBe("Alice's Pod");
  });

  it("throws a missing-entry FolderPathError when the folder has no catalog entry", () => {
    const index = indexOf(node({ uri: STORAGE_ROOT, title: "", parentUri: "" }));
    const missingUri = "https://pod.example/ghost/";
    expect(() => buildFolderPath(missingUri, index, STORAGE_ROOT, "My Pod")).toThrow(FolderPathError);
    try {
      buildFolderPath(missingUri, index, STORAGE_ROOT, "My Pod");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FolderPathError);
      expect((error as FolderPathError).reason).toBe("missing-entry");
      expect((error as FolderPathError).atUri).toBe(missingUri);
    }
  });

  it("throws a missing-entry FolderPathError when an ancestor has no catalog entry", () => {
    const photos = "https://pod.example/my-solid-app/photos/";
    const ghostParent = "https://pod.example/my-solid-app/";
    const index = indexOf(node({ uri: photos, title: "Photos", parentUri: ghostParent }));
    try {
      buildFolderPath(photos, index, STORAGE_ROOT, "My Pod");
      expect.unreachable();
    } catch (error) {
      expect((error as FolderPathError).reason).toBe("missing-entry");
      expect((error as FolderPathError).atUri).toBe(ghostParent);
    }
  });

  it("throws a missing-parent FolderPathError when a current sd:Folder entry has no hasParent", () => {
    const orphan = "https://pod.example/my-solid-app/orphan/";
    const index = indexOf(node({ uri: orphan, title: "Orphan", parentUri: "" }));
    try {
      buildFolderPath(orphan, index, STORAGE_ROOT, "My Pod");
      expect.unreachable();
    } catch (error) {
      expect((error as FolderPathError).reason).toBe("missing-parent");
      expect((error as FolderPathError).atUri).toBe(orphan);
    }
  });

  it("stops gracefully, without throwing, at a legacy folder with no hasParent", () => {
    const legacy = "https://pod.example/my-solid-app/cat-test/";
    const index = indexOf(node({ uri: legacy, title: "cat-test", parentUri: "", conformsTo: LEGACY_CLASS_URI }));
    const crumbs = buildFolderPath(legacy, index, STORAGE_ROOT, "My Pod");
    expect(crumbs).toEqual([{ label: "cat-test", uri: legacy }]);
  });

  it("stops at a legacy ancestor reached partway up a chain, without throwing", () => {
    const legacyParent = "https://pod.example/my-solid-app/cat-test/";
    const newChild = "https://pod.example/my-solid-app/cat-test/new-sub/";
    const index = indexOf(
      node({ uri: legacyParent, title: "cat-test", parentUri: "", conformsTo: LEGACY_CLASS_URI }),
      node({ uri: newChild, title: "new-sub", parentUri: legacyParent })
    );
    const crumbs = buildFolderPath(newChild, index, STORAGE_ROOT, "My Pod");
    expect(crumbs).toEqual([
      { label: "cat-test", uri: legacyParent },
      { label: "new-sub", uri: newChild },
    ]);
  });

  it("throws a cycle FolderPathError when hasParent links loop", () => {
    const a = "https://pod.example/a/";
    const b = "https://pod.example/b/";
    const index = indexOf(
      node({ uri: a, title: "A", parentUri: b }),
      node({ uri: b, title: "B", parentUri: a })
    );
    try {
      buildFolderPath(a, index, STORAGE_ROOT, "My Pod");
      expect.unreachable();
    } catch (error) {
      expect((error as FolderPathError).reason).toBe("cycle");
    }
  });

  it("throws a too-deep FolderPathError when the chain never reaches the root within the depth cap", () => {
    const nodes: FolderNode[] = [];
    let parentUri = "";
    for (let level = 0; level < 100; level += 1) {
      const uri = `https://pod.example/level-${level}/`;
      nodes.push(node({ uri, title: `Level ${level}`, parentUri }));
      parentUri = uri;
    }
    const index = indexOf(...nodes);
    const deepest = nodes[nodes.length - 1].uri;
    try {
      buildFolderPath(deepest, index, STORAGE_ROOT, "My Pod");
      expect.unreachable();
    } catch (error) {
      expect((error as FolderPathError).reason).toBe("too-deep");
    }
  });
});
