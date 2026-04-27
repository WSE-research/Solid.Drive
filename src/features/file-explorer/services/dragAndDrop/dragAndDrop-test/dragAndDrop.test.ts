import { describe, it, expect } from 'vitest';
import { hasUnsupportedFolderDrop } from '../dragAndDrop-file/dragAndDrop';

function makeDataTransfer(items: Array<{ kind: string; entry?: { isDirectory: boolean; isFile: boolean } | null }>): DataTransfer {
  return {
    items: items.map((item) => ({
      kind: item.kind,
      webkitGetAsEntry: item.entry === undefined ? undefined : () => item.entry ?? null,
    })),
  } as unknown as DataTransfer;
}

describe('hasUnsupportedFolderDrop', () => {
  it('returns false when DataTransfer is null', () => {
    expect(hasUnsupportedFolderDrop(null)).toBe(false);
  });

  it('returns false when there are no items', () => {
    expect(hasUnsupportedFolderDrop(makeDataTransfer([]))).toBe(false);
  });

  it('returns false for a single regular file', () => {
    const dataTransfer = makeDataTransfer([
      { kind: 'file', entry: { isDirectory: false, isFile: true } },
    ]);
    expect(hasUnsupportedFolderDrop(dataTransfer)).toBe(false);
  });

  it('returns true when any item is a directory', () => {
    const dataTransfer = makeDataTransfer([
      { kind: 'file', entry: { isDirectory: false, isFile: true } },
      { kind: 'file', entry: { isDirectory: true, isFile: false } },
    ]);
    expect(hasUnsupportedFolderDrop(dataTransfer)).toBe(true);
  });

  it('skips non-file items (e.g. dragged text)', () => {
    const dataTransfer = makeDataTransfer([
      { kind: 'string', entry: { isDirectory: true, isFile: false } },
    ]);
    expect(hasUnsupportedFolderDrop(dataTransfer)).toBe(false);
  });

  it('returns false when webkitGetAsEntry is not available on the item', () => {
    const dataTransfer = makeDataTransfer([
      { kind: 'file' },
    ]);
    expect(hasUnsupportedFolderDrop(dataTransfer)).toBe(false);
  });
});
