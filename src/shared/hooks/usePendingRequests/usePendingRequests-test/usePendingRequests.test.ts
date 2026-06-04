import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePendingRequests, useRequestStatus } from '../usePendingRequests-file/usePendingRequests';

const STORAGE_KEY = 'solid-drive.pendingRequestIds';
const TARGET = 'https://alice.example/files/photo/';

describe('usePendingRequests', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    const { result } = renderHook(() => usePendingRequests());
    expect(result.current.isPending(TARGET)).toBe(false);
  });

  it('reads a persisted pending target on init', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([TARGET]));
    const { result } = renderHook(() => usePendingRequests());
    expect(result.current.isPending(TARGET)).toBe(true);
  });

  it('falls back to empty on corrupted storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => usePendingRequests());
    expect(result.current.isPending(TARGET)).toBe(false);
  });

  it('markPending persists and clearPending removes', () => {
    const { result } = renderHook(() => usePendingRequests());
    act(() => result.current.markPending(TARGET));
    expect(result.current.isPending(TARGET)).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toContain(TARGET);

    act(() => result.current.clearPending(TARGET));
    expect(result.current.isPending(TARGET)).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).not.toContain(TARGET);
  });

  it('markPending is a no-op when already pending', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([TARGET]));
    const { result } = renderHook(() => usePendingRequests());
    const before = localStorage.getItem(STORAGE_KEY);
    act(() => result.current.markPending(TARGET));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('keeps two instances in sync via the change event', () => {
    const { result: a } = renderHook(() => usePendingRequests());
    const { result: b } = renderHook(() => usePendingRequests());
    act(() => a.current.markPending(TARGET));
    expect(b.current.isPending(TARGET)).toBe(true);
    act(() => a.current.clearPending(TARGET));
    expect(b.current.isPending(TARGET)).toBe(false);
  });
});

describe('useRequestStatus', () => {
  beforeEach(() => localStorage.clear());

  const pending = () => localStorage.setItem(STORAGE_KEY, JSON.stringify([TARGET]));

  it('is "none" with no signal and no pending flag', () => {
    const { result } = renderHook(() => useRequestStatus(TARGET, { approved: false, denied: false }));
    expect(result.current).toBe('none');
  });

  it('is "pending" while requested and nothing has resolved', () => {
    pending();
    const { result } = renderHook(() => useRequestStatus(TARGET, { approved: false, denied: false }));
    expect(result.current).toBe('pending');
  });

  it('is "approved" when an approval notice exists', () => {
    const { result } = renderHook(() => useRequestStatus(TARGET, { approved: true, denied: false }));
    expect(result.current).toBe('approved');
  });

  it('is "denied" whenever a rejection exists', () => {
    const { result } = renderHook(() => useRequestStatus(TARGET, { approved: false, denied: true }));
    expect(result.current).toBe('denied');
  });

  it('prefers a live approval over a stale rejection', () => {
    pending();
    const { result } = renderHook(() => useRequestStatus(TARGET, { approved: true, denied: true }));
    expect(result.current).toBe('approved');
  });

  it('keeps the pending flag while unresolved', () => {
    pending();
    renderHook(() => useRequestStatus(TARGET, { approved: false, denied: false }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toContain(TARGET);
  });
});
