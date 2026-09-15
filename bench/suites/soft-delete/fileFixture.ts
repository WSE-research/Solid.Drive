/**
 * @packageDocumentation
 * Builds a fake file the same way the app stores a real upload: 
 * a container holding a binary payload and its metadata. 
 * The soft-delete benchmarks use these to create a file
 * and then hand it to the delete function in the exact shape that function expects.
 */

import type { SharedEntry } from "@/types";

export interface FileLayout {
  containerUri: string;
  binaryUri: string;
  indexUri: string;
}

// Composes the per-file container, binary and index URIs.
export function fileLayout(storageRootUri: string, slug: string): FileLayout {
  const containerUri = `${storageRootUri}files/${slug}/`;
  return {
    containerUri,
    binaryUri: `${containerUri}payload`,
    indexUri: `${containerUri}index.ttl`,
  };
}

// Returns a body of the requested byte length.
export function sizedBinary(byteSize: number): Uint8Array {
  return new Uint8Array(byteSize);
}

export interface FileDescriptor {
  layout: FileLayout;
  webId: string;
  byteSize: number;
  classUri: string;
  mediaType: string;
  title: string;
  modified: string;
}

// creates a Turtle document that describes the file's metadata, embedding the descriptor's fields.
export function indexTurtle(descriptor: FileDescriptor): string {
  return `@prefix schema: <https://schema.org/> .
<${descriptor.layout.indexUri}> schema:name "${descriptor.title}" ;
  schema:encodingFormat "${descriptor.mediaType}" ;
  schema:contentSize "${descriptor.byteSize}" ;
  schema:uploadDate "${descriptor.modified}" ;
  schema:publisher <${descriptor.webId}> .
`;
}

// Builds the file entry used by the soft-delete service.
export function sharedEntry(descriptor: FileDescriptor, description = ""): SharedEntry {
  return {
    metadataUri: descriptor.layout.indexUri,
    binaryUri: descriptor.layout.binaryUri,
    classUri: descriptor.classUri,
    mediaType: descriptor.mediaType,
    byteSize: descriptor.byteSize,
    title: descriptor.title,
    description,
    modified: descriptor.modified,
  };
}
