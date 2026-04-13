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
}
