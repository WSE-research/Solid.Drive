import { describe, it, expect } from 'vitest';
import { Store, DataFactory } from 'n3';
import { RDF_NAMESPACES } from '@/config';
import { readModifiedFromDataset } from '../useResourceModified-file/useResourceModified';

const { namedNode, literal, quad } = DataFactory;

const FOLDER_URI = 'https://pod.example/app/photos/';

function storeWith(predicate: string, value: string): Store {
  const store = new Store();
  store.addQuad(quad(namedNode(FOLDER_URI), namedNode(predicate), literal(value)));
  return store;
}

describe('readModifiedFromDataset', () => {
  it('reads dcterms:modified as an ISO timestamp', () => {
    const store = storeWith(`${RDF_NAMESPACES.DCTERMS}modified`, '2026-05-01T12:00:00Z');
    expect(readModifiedFromDataset(store, FOLDER_URI)).toBe('2026-05-01T12:00:00Z');
  });

  it('falls back to POSIX mtime (unix seconds) converted to ISO', () => {
    const store = storeWith(`${RDF_NAMESPACES.POSIX}mtime`, '1700000000');
    expect(readModifiedFromDataset(store, FOLDER_URI)).toBe(
      new Date(1700000000 * 1000).toISOString(),
    );
  });

  it('prefers dcterms:modified over mtime when both are present', () => {
    const store = storeWith(`${RDF_NAMESPACES.DCTERMS}modified`, '2026-05-01T12:00:00Z');
    store.addQuad(
      quad(namedNode(FOLDER_URI), namedNode(`${RDF_NAMESPACES.POSIX}mtime`), literal('1700000000')),
    );
    expect(readModifiedFromDataset(store, FOLDER_URI)).toBe('2026-05-01T12:00:00Z');
  });

  it('returns undefined when the resource has no modified metadata', () => {
    expect(readModifiedFromDataset(new Store(), FOLDER_URI)).toBeUndefined();
  });

  it('returns undefined when mtime is not a number', () => {
    const store = storeWith(`${RDF_NAMESPACES.POSIX}mtime`, 'not-a-number');
    expect(readModifiedFromDataset(store, FOLDER_URI)).toBeUndefined();
  });
});
