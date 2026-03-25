import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

// LDO exposes capabilities via method presence instead of a class hierarchy
// These interfaces describe those shapes so we can safely narrow resources
// without depending on internal LDO types
export interface LoadableResource {
  isLoading: () => boolean;
}

export interface ReadableResource {
  isReading: () => boolean;
}

export interface BinaryResource {
  isBinary: () => boolean;
  getBlob: () => Blob;
}

export interface DeletableResource {
  delete: () => Promise<void>;
}

export interface ReloadableResource {
  reload: () => Promise<void>;
}

export interface UploadResult {
  isError: boolean;
  message: string;
  resource: SolidLeaf;
}

export interface FileContainerResource {
  uploadChildAndOverwrite: (
    name: string,
    file: File,
    mimeType: string
  ) => Promise<UploadResult>;
  child: (name: string) => unknown;
}

export interface ContainerCreationResult {
  isError: boolean;
  message: string;
  resource: FileContainerResource;
}

// Type guards for resource capabilities

/** Returns true if the resource exposes an `isLoading` method. */
export function isLoadable(result: unknown): result is LoadableResource {
  return typeof result === "object" && result !== null && "isLoading" in result;
}

/** Returns true if the resource exposes an `isReading` method. */
export function isReadable(result: unknown): result is ReadableResource {
  return typeof result === "object" && result !== null && "isReading" in result;
}

/** Returns true if the resource exposes `isBinary` and `getBlob` methods. */
export function isBinary(result: unknown): result is BinaryResource {
  return typeof result === "object" && result !== null && "isBinary" in result && "getBlob" in result;
}

/** Returns true if the resource exposes a `delete` method. */
export function isDeletable(result: unknown): result is DeletableResource {
  return typeof result === "object" && result !== null && "delete" in result;
}

/** Returns true if the resource exposes a `reload` method. */
export function isReloadable(result: unknown): result is ReloadableResource {
  return typeof result === "object" && result !== null && "reload" in result;
}

/** Returns true if the resource is a Solid container (has a `children` function). */
export function isSolidContainer(result: unknown): result is SolidContainer {
  return (
    typeof result === "object" &&
    result !== null &&
    "children" in result &&
    typeof (result as SolidContainer).children === "function"
  );
}

/** Returns true if the resource is a Solid leaf (non-container resource). */
export function isSolidLeaf(result: unknown): result is SolidLeaf {
  return (
    !!result &&
    typeof result === "object" &&
    "type" in result &&
    (result as SolidLeaf).type === "SolidLeaf"
  );
}

//  Utilities

/**
 * Converts a byte count (as a string) into a human-readable size string.
 * Returns KB or MB for larger files, and an empty string for zero bytes.
 */
export function formatBytes(bytes: string | undefined): string {
  const byteCount = parseInt(bytes ?? "0", 10);
  if (!byteCount) return "";
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}
