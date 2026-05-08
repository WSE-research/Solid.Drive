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

import { useObservedSharedTypes } from '../SharedView-file/useObservedSharedTypes';
import {
  FOLDER_CHIP_ID,
  PDF_CHIP_ID,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';

const REPORT_DEFAULTS = { hasFolder: false, hasPdf: false };

describe('useObservedSharedTypes', () => {
  it('starts with an empty chip set', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    expect(result.current.chips).toEqual([]);
  });

  it('aggregates classes from one contact', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
    });
    expect(result.current.chips.map((chip) => chip.id)).toEqual([
      'http://schema.org/ImageObject',
    ]);
  });

  it('merges classes across multiple contacts', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
      result.current.report('with-you::https://bob/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/DigitalDocument']),
      });
    });
    const ids = result.current.chips.map((chip) => chip.id);
    expect(ids).toContain('http://schema.org/ImageObject');
    expect(ids).toContain('http://schema.org/DigitalDocument');
  });

  it('prepends the Folder chip when any contact reports a folder', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        hasFolder: true,
        classes: new Set(),
      });
    });
    expect(result.current.chips[0].id).toBe(FOLDER_CHIP_ID);
  });

  it('prepends the PDF chip when any contact reports a PDF', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        hasPdf: true,
        classes: new Set(),
      });
    });
    expect(result.current.chips[0].id).toBe(PDF_CHIP_ID);
  });

  it('replaces a contact report when it changes', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
    });
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/AudioObject']),
      });
    });
    expect(result.current.chips.map((chip) => chip.id)).toEqual([
      'http://schema.org/AudioObject',
    ]);
  });

  it('does not re-render when the same set is reported again', () => {
    const { result, rerender } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
    });
    const afterFirst = result.current.chips;
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
    });
    rerender();
    expect(result.current.chips).toBe(afterFirst);
  });

  it('reset clears every observation', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
    });
    expect(result.current.chips.length).toBeGreaterThan(0);
    act(() => result.current.reset());
    expect(result.current.chips).toEqual([]);
  });

  it('updates when the class set changes (class added)', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
    });
    const afterFirst = result.current.chips;
    // Add a new class — the map should update and return a new chip array.
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/DigitalDocument']),
      });
    });
    expect(result.current.chips).not.toBe(afterFirst);
    expect(result.current.chips.map((c) => c.id)).toEqual([
      'http://schema.org/DigitalDocument',
    ]);
  });

  it('updates when hasPdf flag changes from false to true', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        hasPdf: false,
        classes: new Set(),
      });
    });
    expect(result.current.chips.map((c) => c.id)).not.toContain(PDF_CHIP_ID);
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        hasPdf: true,
        classes: new Set(),
      });
    });
    expect(result.current.chips.map((c) => c.id)).toContain(PDF_CHIP_ID);
  });

  it('reset is a no-op when the map is already empty', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    // The map starts empty; calling reset should not cause errors.
    act(() => result.current.reset());
    expect(result.current.chips).toEqual([]);
  });

  it('keeps observations from different directions separate', () => {
    const { result } = renderHook(() => useObservedSharedTypes());
    act(() => {
      result.current.report('with-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/ImageObject']),
      });
      result.current.report('by-you::https://alice/me', {
        ...REPORT_DEFAULTS,
        classes: new Set(['http://schema.org/DigitalDocument']),
      });
    });
    const ids = result.current.chips.map((chip) => chip.id);
    expect(ids).toContain('http://schema.org/ImageObject');
    expect(ids).toContain('http://schema.org/DigitalDocument');
  });
});
