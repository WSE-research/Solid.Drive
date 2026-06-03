/**
 * Reads a resource's last-modified timestamp straight from its RDF
 * metadata. Solid servers describe each container and file with
 * `dcterms:modified` (and, on some servers, a POSIX `stat:mtime`), so a
 * bare folder can show a date without any catalog entry backing it.
 *
 * @packageDocumentation
 */

import { useLdo, useResource } from '@ldo/solid-react';
import { DataFactory } from 'n3';
import type { DatasetCore, Term } from '@rdfjs/types';
import { RDF_NAMESPACES } from '@/config';

const { namedNode } = DataFactory;

const MODIFIED_PREDICATE = namedNode(`${RDF_NAMESPACES.DCTERMS}modified`);
const MTIME_PREDICATE = namedNode(`${RDF_NAMESPACES.POSIX}mtime`);

function firstObjectValue(
  dataset: DatasetCore,
  subject: Term,
  predicate: Term,
): string | undefined {
  for (const quad of dataset.match(subject, predicate, null, null)) {
    return quad.object.value;
  }
  return undefined;
}

/**
 * Extracts an ISO last-modified timestamp for a resource from an RDF
 * dataset. Prefers `dcterms:modified`; falls back to the POSIX
 * `stat:mtime` (unix seconds) converted to ISO. Returns undefined when
 * neither predicate is present.
 *
 * @public
 */
export function readModifiedFromDataset(
  dataset: DatasetCore,
  uri: string,
): string | undefined {
  const subject = namedNode(uri);

  const modified = firstObjectValue(dataset, subject, MODIFIED_PREDICATE);
  if (modified) return modified;

  const mtime = firstObjectValue(dataset, subject, MTIME_PREDICATE);
  if (!mtime) return undefined;
  const seconds = Number(mtime);
  if (Number.isNaN(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Returns the last-modified ISO timestamp for a resource, read from the
 * resource's own RDF metadata. Triggers (and subscribes to) the fetch
 * via `useResource`, so the value fills in once the resource loads.
 * Returns undefined while loading or when the resource is undefined.
 *
 * @public
 */
export function useResourceModified(uri: string | undefined): string | undefined {
  useResource(uri);
  const { dataset } = useLdo();
  if (!uri) return undefined;
  return readModifiedFromDataset(dataset, uri);
}
