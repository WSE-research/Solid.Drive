/**
 * @packageDocumentation
 * Builds the breadcrumb trail from a folder up to the storage root by
 * following sd:hasParent links, instead of splitting the folder's URI.
 */

import type { SolidContainerUri } from "@ldo/connected-solid";
import type { FolderIndex } from "@/types";
import type { Breadcrumb } from "@/features/file-explorer/hooks/useNavigation";
import { FOLDER_CLASS_URI } from "@/infrastructure/solid/catalog";

/** Distinguishes why a folder path could not be built. */
export type FolderPathErrorReason = "missing-entry" | "missing-parent" | "cycle" | "too-deep";

/**
 * Thrown by {@link buildFolderPath} when a folder's hasParent chain is
 * broken. `atUri` is the folder where the walk failed, which may be the
 * requested folder itself or one of its ancestors.
 *
 * @public
 */
export class FolderPathError extends Error {
  readonly reason: FolderPathErrorReason;
  readonly atUri: string;

  constructor(reason: FolderPathErrorReason, atUri: string, message: string) {
    super(message);
    this.name = "FolderPathError";
    this.reason = reason;
    this.atUri = atUri;
  }
}

/** Depth cap against a corrupted catalog that would otherwise loop forever. */
const MAX_FOLDER_DEPTH = 64;

/**
 * Walks `folderUri` up through `index` via sd:hasParent until it reaches
 * `storageRootUri`, returning the trail root-first.
 *
 * @remarks
 * Pure and synchronous: `index` must already hold every folder in the
 * catalog. The root's `title` may be empty by design; `rootLabel` fills
 * that in.
 *
 * @param folderUri - Container URI of the folder to build the trail for
 * @param index - Every folder in the catalog, keyed by container URI
 * @param storageRootUri - The pod's storage root, the walk's stopping point
 * @param rootLabel - Label used for the root crumb when its title is empty
 * @throws {@link FolderPathError} if a link in the chain is missing, cycles, or exceeds the depth cap
 *
 * @public
 */
export function buildFolderPath(
  folderUri: string,
  index: FolderIndex,
  storageRootUri: string,
  rootLabel: string
): Breadcrumb[] {
  const chain: Breadcrumb[] = [];
  const visited = new Set<string>();
  let currentUri = folderUri;

  const finish = (): Breadcrumb[] => {
    chain.reverse();
    if (!chain[0].label) chain[0] = { ...chain[0], label: rootLabel };
    return chain;
  };

  for (let depth = 0; depth <= MAX_FOLDER_DEPTH; depth += 1) {
    if (visited.has(currentUri)) {
      throw new FolderPathError("cycle", currentUri, `Folder path cycles back to ${currentUri}`);
    }
    visited.add(currentUri);

    const node = index.get(currentUri);
    if (!node) {
      throw new FolderPathError("missing-entry", currentUri, `No catalog entry for folder ${currentUri}`);
    }
    chain.push({ label: node.title, uri: node.uri as SolidContainerUri });

    if (currentUri === storageRootUri) return finish();

    if (!node.parentUri) {
      // A folder from before this vocabulary existed has no hasParent
      // link; that's expected, so the trail just stops here. Only a
      // current sd:Folder entry with no parent is a real broken link.
      if (node.conformsTo !== FOLDER_CLASS_URI) return finish();
      throw new FolderPathError(
        "missing-parent",
        currentUri,
        `Folder ${currentUri} has no sd:hasParent link and is not the storage root`
      );
    }
    currentUri = node.parentUri;
  }

  throw new FolderPathError(
    "too-deep",
    folderUri,
    `Folder path from ${folderUri} exceeded ${MAX_FOLDER_DEPTH} levels`
  );
}
