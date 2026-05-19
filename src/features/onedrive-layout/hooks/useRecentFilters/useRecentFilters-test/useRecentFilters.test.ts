import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRecentFilters } from '../useRecentFilters-file/useRecentFilters';
import type { CatalogEntry } from '@/types';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://pod.example/my-solid-app/notes/index.ttl',
  conformsTo: 'http://schema.org/DigitalDocument',
  title: 'Notes.docx',
  description: '',
  modified: '2026-04-22T10:00:00Z',
  publisher: 'https://pod.example/profile/card#me',
  mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  byteSize: 2048,
  accessURL: 'https://pod.example/my-solid-app/notes/Notes.docx',
  ...overrides,
});

describe('useRecentFilters', () => {
  it('starts with no chip selection and an empty query', () => {
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [], ownerName: 'Alice' }),
    );
    expect(result.current.selectedChips.size).toBe(0);
    expect(result.current.query).toBe('');
    expect(result.current.visibleEntries).toEqual([]);
  });

  it('sorts visibleEntries by modified date desc', () => {
    const older = makeEntry({ uri: 'https://x/older/index.ttl', title: 'older', modified: '2026-01-01T00:00:00Z' });
    const newer = makeEntry({ uri: 'https://x/newer/index.ttl', title: 'newer', modified: '2026-04-01T00:00:00Z' });
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [older, newer], ownerName: 'Alice' }),
    );
    expect(result.current.visibleEntries.map((e) => e.title)).toEqual(['newer', 'older']);
  });

  it('treats an entry without modified as oldest (sorts to end)', () => {
    const dated = makeEntry({ uri: 'https://x/a/index.ttl', title: 'dated' });
    const undated = makeEntry({ uri: 'https://x/b/index.ttl', title: 'undated', modified: undefined });
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [undated, dated], ownerName: 'Alice' }),
    );
    expect(result.current.visibleEntries.map((e) => e.title)).toEqual(['dated', 'undated']);
  });

  it('filters by case-insensitive title match against the query', () => {
    const a = makeEntry({ uri: 'https://x/a/index.ttl', title: 'Report' });
    const b = makeEntry({ uri: 'https://x/b/index.ttl', title: 'Photo' });
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [a, b], ownerName: 'Alice' }),
    );
    act(() => result.current.setQuery('rep'));
    expect(result.current.visibleEntries.map((e) => e.title)).toEqual(['Report']);
  });

  it('matches the query against the owner name as well', () => {
    const a = makeEntry({ uri: 'https://x/a/index.ttl', title: 'Report' });
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [a], ownerName: 'Alice Doe' }),
    );
    act(() => result.current.setQuery('alice'));
    expect(result.current.visibleEntries).toHaveLength(1);
  });

  it('toggleChip is single-select and re-toggles to clear', () => {
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [], ownerName: 'Alice' }),
    );
    act(() => result.current.toggleChip('a'));
    expect([...result.current.selectedChips]).toEqual(['a']);
    act(() => result.current.toggleChip('b'));
    expect([...result.current.selectedChips]).toEqual(['b']);
    act(() => result.current.toggleChip('b'));
    expect(result.current.selectedChips.size).toBe(0);
  });

  it('resetChips clears the current selection', () => {
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [], ownerName: 'Alice' }),
    );
    act(() => result.current.toggleChip('a'));
    act(() => result.current.resetChips());
    expect(result.current.selectedChips.size).toBe(0);
  });

  it('derives the chip set from the catalog entries', () => {
    const a = makeEntry({ uri: 'https://x/a/index.ttl', conformsTo: 'http://schema.org/ImageObject' });
    const b = makeEntry({ uri: 'https://x/b/index.ttl', conformsTo: 'http://schema.org/VideoObject' });
    const { result } = renderHook(() =>
      useRecentFilters({ catalogEntries: [a, b], ownerName: 'Alice' }),
    );
    expect(result.current.chips.length).toBeGreaterThan(0);
  });
});
