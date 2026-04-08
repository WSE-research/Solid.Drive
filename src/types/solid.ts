/**
 * @packageDocumentation
 * Core Solid resource types used across the app.
 */

import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

export type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

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

export interface ProfileFields {
  name: string;
  imgUrl: string;
}

export type { SolidContainer, SolidLeaf };
