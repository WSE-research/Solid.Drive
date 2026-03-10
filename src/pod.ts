import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

//  Resource capability interfaces and related type guards

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

// Upload API response shapes and related types

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

export function isLoadable(result: unknown): result is LoadableResource {
  return typeof result === "object" && result !== null && "isLoading" in result;
}

export function isReadable(result: unknown): result is ReadableResource {
  return typeof result === "object" && result !== null && "isReading" in result;
}

export function isBinary(result: unknown): result is BinaryResource {
  return typeof result === "object" && result !== null && "isBinary" in result && "getBlob" in result;
}

export function isDeletable(result: unknown): result is DeletableResource {
  return typeof result === "object" && result !== null && "delete" in result;
}

export function isReloadable(result: unknown): result is ReloadableResource {
  return typeof result === "object" && result !== null && "reload" in result;
}

export function isSolidContainer(result: unknown): result is SolidContainer {
  return (
    typeof result === "object" &&
    result !== null &&
    "children" in result &&
    typeof (result as SolidContainer).children === "function"
  );
}

export function isSolidLeaf(result: unknown): result is SolidLeaf {
  return (
    !!result &&
    typeof result === "object" &&
    "type" in result &&
    (result as SolidLeaf).type === "SolidLeaf"
  );
}

//  Utilities 

export function formatBytes(bytes: string | undefined): string {
  const byteCount = parseInt(bytes ?? "0", 10);
  if (!byteCount) return "";
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}
