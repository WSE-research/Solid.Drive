import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/features/onedrive-layout/icons', () => {
  const Stub = () => null;
  return {
    WordChipIcon: Stub,
    ExcelChipIcon: Stub,
    PowerPointChipIcon: Stub,
    PdfChipIcon: Stub,
    FolderChipIcon: Stub,
    ImageChipIcon: Stub,
    VideoChipIcon: Stub,
    AudioChipIcon: Stub,
    GenericFileChipIcon: Stub,
  };
});

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => {
    const tail = uri.split('/').pop() ?? uri;
    return { label: tail, description: '' };
  },
}));

import { useSharedFilters } from '../useSharedFilters-file/useSharedFilters';
import {
  chipForClassUri,
  chipForFolder,
  FOLDER_CHIP_ID,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';

const imageChip = chipForClassUri('http://schema.org/ImageObject');
const docChip = chipForClassUri('http://schema.org/DigitalDocument');
const folderChip = chipForFolder();
const ALL_CHIPS = [folderChip, imageChip, docChip];

describe('useSharedFilters — initial state', () => {
  it('starts with no selected chips and an empty query', () => {
    const { result } = renderHook(() => useSharedFilters());
    expect(result.current.selectedClasses.size).toBe(0);
    expect(result.current.personQuery).toBe('');
    expect(result.current.isActive).toBe(false);
  });

  it('matchesEntry returns true for any entry when no chip is selected', () => {
    const { result } = renderHook(() => useSharedFilters());
    expect(
      result.current.matchesEntry(
        { conformsTo: 'http://schema.org/ImageObject' },
        ALL_CHIPS,
      ),
    ).toBe(true);
  });
});

describe('useSharedFilters — single-select chip toggle', () => {
  it('selects a chip when toggled from empty', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.toggleClass('http://schema.org/ImageObject'));
    expect([...result.current.selectedClasses]).toEqual([
      'http://schema.org/ImageObject',
    ]);
  });

  it('replaces the selection when a different chip is toggled', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.toggleClass('http://schema.org/ImageObject'));
    act(() => result.current.toggleClass('http://schema.org/DigitalDocument'));
    expect([...result.current.selectedClasses]).toEqual([
      'http://schema.org/DigitalDocument',
    ]);
  });

  it('clears the selection when re-clicking the active chip', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.toggleClass('http://schema.org/ImageObject'));
    act(() => result.current.toggleClass('http://schema.org/ImageObject'));
    expect(result.current.selectedClasses.size).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('reset clears the active chip', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.toggleClass('http://schema.org/ImageObject'));
    act(() => result.current.resetClasses());
    expect(result.current.selectedClasses.size).toBe(0);
  });

  it('matchesEntry honors the single selected chip', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.toggleClass('http://schema.org/ImageObject'));
    expect(
      result.current.matchesEntry(
        { conformsTo: 'http://schema.org/ImageObject' },
        ALL_CHIPS,
      ),
    ).toBe(true);
    expect(
      result.current.matchesEntry(
        { conformsTo: 'http://schema.org/DigitalDocument' },
        ALL_CHIPS,
      ),
    ).toBe(false);
  });

  it('Folder chip matches entries with isFolder=true', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.toggleClass(FOLDER_CHIP_ID));
    expect(result.current.matchesEntry({ isFolder: true }, ALL_CHIPS)).toBe(true);
    expect(result.current.matchesEntry({ isFolder: false }, ALL_CHIPS)).toBe(false);
  });
});

describe('useSharedFilters — person query', () => {
  it('marks itself active when the query is non-empty', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.setPersonQuery('ali'));
    expect(result.current.isActive).toBe(true);
  });

  it('matches by display name (case-insensitive)', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.setPersonQuery('ALICE'));
    expect(result.current.matchesContact('Alice Doe', 'https://x/me')).toBe(true);
    expect(result.current.matchesContact('Bob', 'https://x/me')).toBe(false);
  });

  it('matches by WebID substring when name does not match', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.setPersonQuery('alice.example'));
    expect(
      result.current.matchesContact('A.', 'https://alice.example/profile/card#me'),
    ).toBe(true);
  });

  it('treats whitespace-only queries as empty', () => {
    const { result } = renderHook(() => useSharedFilters());
    act(() => result.current.setPersonQuery('   '));
    expect(result.current.isActive).toBe(false);
    expect(result.current.matchesContact('Bob', 'https://x/me')).toBe(true);
  });
});
