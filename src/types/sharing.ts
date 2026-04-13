/**
 * @packageDocumentation
 * Types for the file sharing layer.
 */

/**
 * Metadata snapshot passed from a FileCard to the sharing layer (ACL manager,
 * shared catalog) so the file can be described in a recipient's catalog entry
 * without re-fetching its metadata.
 */
export interface SharedEntry {
  metadataUri: string;
  binaryUri: string;
  classUri: string;
  mediaType: string;
  byteSize: number;
  title: string;
  description: string;
  modified: string;
}
