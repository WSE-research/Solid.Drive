import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

// LDO exposes capabilities via method presence, not class hierarchy.
// These interfaces let us narrow resources without depending on internal LDO types.
export interface LoadableResource {
  isLoading: () => boolean;
  isUnfetched: () => boolean;
  isFetched: () => boolean;
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

/** Returns true if the resource exposes the full loadable resource shape. */
export function isLoadable(resource: unknown): resource is LoadableResource {
  return typeof resource === "object" && resource !== null && "isLoading" in resource && "isUnfetched" in resource && "isFetched" in resource;
}

/** Returns true if the resource exposes an `isReading` method. */
export function isReadable(resource: unknown): resource is ReadableResource {
  return typeof resource === "object" && resource !== null && "isReading" in resource;
}

/** Returns true if the resource exposes `isBinary` and `getBlob` methods. */
export function isBinary(resource: unknown): resource is BinaryResource {
  return typeof resource === "object" && resource !== null && "isBinary" in resource && "getBlob" in resource;
}

/** Returns true if the resource exposes a `delete` method. */
export function isDeletable(resource: unknown): resource is DeletableResource {
  return typeof resource === "object" && resource !== null && "delete" in resource;
}

/** Returns true if the resource exposes a `reload` method. */
export function isReloadable(resource: unknown): resource is ReloadableResource {
  return typeof resource === "object" && resource !== null && "reload" in resource;
}

/** Returns true if the resource is a Solid container (has a `children` function). */
export function isSolidContainer(resource: unknown): resource is SolidContainer {
  return (
    typeof resource === "object" &&
    resource !== null &&
    "children" in resource &&
    typeof (resource as SolidContainer).children === "function"
  );
}

/** Returns true if the resource is a Solid leaf (non-container resource). */
export function isSolidLeaf(resource: unknown): resource is SolidLeaf {
  return (
    !!resource &&
    typeof resource === "object" &&
    "type" in resource &&
    (resource as SolidLeaf).type === "SolidLeaf"
  );
}

//  Utilities

/**
 * Format a byte count string into a readable size (B, KB, or MB).
 * Returns empty string for zero/undefined bytes.
 */
export function formatBytes(bytes: string | undefined): string {
  const byteCount = parseInt(bytes ?? "0", 10);
  if (!byteCount) return "";
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}
