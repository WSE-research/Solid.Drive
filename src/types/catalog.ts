/**
 * @packageDocumentation
 * Metadata shape for files tracked in a Solid catalog.
 */

export interface CatalogEntry {
  uri: string;
  conformsTo: string;
  title: string;
  description: string;
  modified: string;
  publisher: string;
  mediaType: string;
  byteSize: number;
  accessURL: string;
  // URI of the folder entry this entry lives in. Absent for the top storage container, which has no parent.
  parentUri?: string;
}

/** A folder's identity within the catalog's containment tree. */
export interface FolderNode {
  uri: string;
  title: string;
  // Empty for the top storage container, which has no parent.
  parentUri: string;
  // Distinguishes a current sd:Folder from the legacy ldp:Container marker.
  conformsTo: string;
}

/** Every folder in a catalog, keyed by its container URI. */
export type FolderIndex = ReadonlyMap<string, FolderNode>;
