import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSearch } from '../useFileSearch-file/useFileSearch';
import type { CatalogEntry } from '@/types';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://pod.example/file/index.ttl',
  conformsTo: '',
  title: 'Untitled',
  description: '',
  modified: '',
  publisher: '',
  mediaType: 'application/octet-stream',
  byteSize: 0,
  accessURL: '',
  ...overrides,
});

describe('useFileSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const ANNUAL_REPORT_URI = 'https://pod.example/annual-report/index.ttl';
  const BIRTHDAY_PHOTO_URI = 'https://pod.example/birthday-photo/index.ttl';
  const CONTRACT_URI = 'https://pod.example/contract/index.ttl';
  const RECEIPT_URI = 'https://pod.example/receipt-2025/index.ttl';

  const sampleEntries: CatalogEntry[] = [
    makeEntry({ uri: ANNUAL_REPORT_URI, title: 'Annual Report', mediaType: 'application/pdf' }),
    makeEntry({ uri: BIRTHDAY_PHOTO_URI, title: 'Birthday Photo', mediaType: 'image/png' }),
    makeEntry({ uri: CONTRACT_URI, title: 'Contract', mediaType: 'application/pdf' }),
    makeEntry({ uri: RECEIPT_URI, title: 'Receipt 2025', mediaType: 'application/pdf' }),
  ];

  it('returns empty results when query is empty', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, ''));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results).toEqual([]);
    expect(result.current.debouncedQuery).toBe('');
  });

  it('returns empty results for whitespace-only query', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, '   '));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results).toEqual([]);
    expect(result.current.debouncedQuery).toBe('');
  });

  it('matches title case-insensitively', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, 'annual'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map((entry) => entry.uri)).toEqual([ANNUAL_REPORT_URI]);
  });

  it('matches by substring in title', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, 'port'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map((entry) => entry.uri)).toEqual([ANNUAL_REPORT_URI]);
  });

  it('matches mediaType substring', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, 'pdf'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map((entry) => entry.uri).sort()).toEqual(
      [ANNUAL_REPORT_URI, CONTRACT_URI, RECEIPT_URI].sort()
    );
  });

  it('AND-combines multiple terms across title and mediaType', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, 'report pdf'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map((entry) => entry.uri)).toEqual([ANNUAL_REPORT_URI]);
  });

  it('excludes entries that match only some of the terms', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, 'birthday pdf'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results).toEqual([]);
  });

  it('debounces the query change by 200ms', () => {
    const { result, rerender } = renderHook(
      ({ currentQuery }: { currentQuery: string }) => useFileSearch(sampleEntries, currentQuery),
      { initialProps: { currentQuery: '' } },
    );
    rerender({ currentQuery: 'annual' });
    expect(result.current.results).toEqual([]);
    act(() => vi.advanceTimersByTime(199));
    expect(result.current.results).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.results.map((entry) => entry.uri)).toEqual([ANNUAL_REPORT_URI]);
  });

  it('collapses repeated whitespace between terms', () => {
    const { result } = renderHook(() => useFileSearch(sampleEntries, '  report   pdf  '));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map((entry) => entry.uri)).toEqual([ANNUAL_REPORT_URI]);
  });
});
