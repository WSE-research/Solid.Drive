import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSharedSelection, type SharedSelection } from '../SharedView-file/useSharedSelection';

const aliceNotes: SharedSelection = {
  entryUri: 'https://alice/notes/index.ttl',
  binaryUri: 'https://alice/notes/binary',
  title: 'Game design',
  mediaType: 'application/pdf',
};

const aliceSpec: SharedSelection = {
  entryUri: 'https://alice/spec/index.ttl',
  binaryUri: 'https://alice/spec/binary',
  title: 'Spec',
  mediaType: 'application/pdf',
};

describe('useSharedSelection', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useSharedSelection());
    expect(result.current.selected).toBeNull();
  });

  it('select sets the selection', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => result.current.select(aliceNotes));
    expect(result.current.selected).toEqual(aliceNotes);
  });

  it('selecting the same entry twice toggles the selection off', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => result.current.select(aliceNotes));
    act(() => result.current.select(aliceNotes));
    expect(result.current.selected).toBeNull();
  });

  it('selecting a different entry replaces the previous selection', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => result.current.select(aliceNotes));
    act(() => result.current.select(aliceSpec));
    expect(result.current.selected).toEqual(aliceSpec);
  });

  it('clear resets the selection', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => result.current.select(aliceNotes));
    act(() => result.current.clear());
    expect(result.current.selected).toBeNull();
  });

  it('Escape clears the selection while something is selected', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => result.current.select(aliceNotes));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selected).toBeNull();
  });

  it('ignores Escape when nothing is selected', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selected).toBeNull();
  });

  it('ignores non-Escape keys', () => {
    const { result } = renderHook(() => useSharedSelection());
    act(() => result.current.select(aliceNotes));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(result.current.selected).toEqual(aliceNotes);
  });
});
