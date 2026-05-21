import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSeenRequests } from '../useSeenRequests-file/useSeenRequests';

const STORAGE_KEY = 'solid-drive.seenRequestIds';

describe('useSeenRequests', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty set when nothing is stored', () => {
    const { result } = renderHook(() => useSeenRequests());
    expect(result.current.seenIds.size).toBe(0);
    expect(result.current.isSeen('https://pod.example/inbox/msg1')).toBe(false);
  });

  it('reads stored ids on init', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(['https://pod.example/inbox/msg1']),
    );
    const { result } = renderHook(() => useSeenRequests());
    expect(result.current.isSeen('https://pod.example/inbox/msg1')).toBe(true);
  });

  it('falls back to an empty set on corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useSeenRequests());
    expect(result.current.seenIds.size).toBe(0);
  });

  it('falls back to an empty set when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useSeenRequests());
    expect(result.current.seenIds.size).toBe(0);
  });

  it('markSeen persists ids to localStorage', () => {
    const { result } = renderHook(() => useSeenRequests());
    act(() => result.current.markSeen(['https://pod.example/inbox/msg1']));
    expect(result.current.isSeen('https://pod.example/inbox/msg1')).toBe(true);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'),
    ).toContain('https://pod.example/inbox/msg1');
  });

  it('markSeen is a no-op when all ids already exist', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(['https://pod.example/inbox/msg1']),
    );
    const { result } = renderHook(() => useSeenRequests());
    const before = localStorage.getItem(STORAGE_KEY);
    act(() => result.current.markSeen(['https://pod.example/inbox/msg1']));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('markSeen ignores empty input', () => {
    const { result } = renderHook(() => useSeenRequests());
    act(() => result.current.markSeen([]));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps two hook instances in sync via custom event', () => {
    const { result: a } = renderHook(() => useSeenRequests());
    const { result: b } = renderHook(() => useSeenRequests());
    act(() => a.current.markSeen(['https://pod.example/inbox/msg1']));
    expect(b.current.isSeen('https://pod.example/inbox/msg1')).toBe(true);
  });

  it('continues to update in-memory state when localStorage.setItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    const { result } = renderHook(() => useSeenRequests());
    act(() => result.current.markSeen(['https://pod.example/inbox/msg1']));
    expect(result.current.isSeen('https://pod.example/inbox/msg1')).toBe(true);
    spy.mockRestore();
  });

  it('returns an empty set when localStorage.getItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    const { result } = renderHook(() => useSeenRequests());
    expect(result.current.seenIds.size).toBe(0);
    spy.mockRestore();
  });

  it('caps stored ids at 500 entries', () => {
    const { result } = renderHook(() => useSeenRequests());
    const ids = Array.from({ length: 600 }, (_, index) => `urn:msg:${index}`);
    act(() => result.current.markSeen(ids));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(500);
    expect(stored[0]).toBe('urn:msg:100');
    expect(stored[499]).toBe('urn:msg:599');
  });
});
