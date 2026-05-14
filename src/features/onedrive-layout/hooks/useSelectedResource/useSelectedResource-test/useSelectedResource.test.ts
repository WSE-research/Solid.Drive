import { describe, it, expect } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { useSelectedResource } from '../useSelectedResource-file/useSelectedResource';

describe('useSelectedResource', () => {
  it('starts null', () => {
    const { result } = renderHook(() => useSelectedResource());
    expect(result.current.selected).toBeNull();
  });

  it('select sets the resource', () => {
    const { result } = renderHook(() => useSelectedResource());
    act(() => result.current.select({ kind: 'file', uri: 'u', name: 'n' }));
    expect(result.current.selected).toEqual({ kind: 'file', uri: 'u', name: 'n' });
  });

  it('selecting same uri toggles to null', () => {
    const { result } = renderHook(() => useSelectedResource());
    const r = { kind: 'file' as const, uri: 'u', name: 'n' };
    act(() => result.current.select(r));
    act(() => result.current.select(r));
    expect(result.current.selected).toBeNull();
  });

  it('clear sets null', () => {
    const { result } = renderHook(() => useSelectedResource());
    act(() => result.current.select({ kind: 'file', uri: 'u', name: 'n' }));
    act(() => result.current.clear());
    expect(result.current.selected).toBeNull();
  });

  it('Escape clears selection', () => {
    const { result } = renderHook(() => useSelectedResource());
    act(() => result.current.select({ kind: 'file', uri: 'u', name: 'n' }));
    act(() => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(result.current.selected).toBeNull();
  });

  it('selecting a different uri replaces the current selection', () => {
    const { result } = renderHook(() => useSelectedResource());
    act(() => result.current.select({ kind: 'file', uri: 'a', name: 'A' }));
    act(() => result.current.select({ kind: 'folder', uri: 'b', name: 'B' }));
    expect(result.current.selected).toEqual({ kind: 'folder', uri: 'b', name: 'B' });
  });
});
