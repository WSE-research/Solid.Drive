import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilePreview } from '../useFilePreview-file/useFilePreview';

const mockBlob = new Blob(['test'], { type: 'image/png' });
const mockBinaryResource = {
  isBinary: () => true,
  getBlob: () => mockBlob,
};
const mockNonBinaryResource = {};
let mockResource: Record<string, unknown> = mockNonBinaryResource;

vi.mock('@ldo/solid-react', () => ({
  useResource: () => mockResource,
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isBinary: (res: unknown) => res != null && typeof (res as Record<string, unknown>).isBinary === 'function',
}));

// Save originals so they can be restored after each test
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('useFilePreview', () => {
  beforeEach(() => {
    mockResource = mockNonBinaryResource;
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-id');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    // Restore originals, falling back to no-op so deferred React passive
    // effect cleanup never encounters a non-function value in jsdom.
    URL.createObjectURL = originalCreateObjectURL ?? ((() => '') as typeof URL.createObjectURL);
    URL.revokeObjectURL = originalRevokeObjectURL ?? (() => {});
  });

  it('returns undefined previewUrl when resource is not binary', () => {
    mockResource = mockNonBinaryResource;
    const { result } = renderHook(() => useFilePreview('https://pod.example/file.png'));
    expect(result.current.previewUrl).toBeUndefined();
  });

  it('returns a blob URL when resource is binary', () => {
    mockResource = mockBinaryResource;
    const { result } = renderHook(() => useFilePreview('https://pod.example/file.png'));
    expect(result.current.previewUrl).toBe('blob:http://localhost/fake-id');
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
  });

  it('returns undefined previewUrl when binaryUri is undefined', () => {
    mockResource = undefined as unknown as Record<string, unknown>;
    const { result } = renderHook(() => useFilePreview(undefined));
    expect(result.current.previewUrl).toBeUndefined();
  });

  it('revokes the blob URL on unmount to prevent memory leaks', () => {
    mockResource = mockBinaryResource;
    const { unmount } = renderHook(() => useFilePreview('https://pod.example/file.png'));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-id');
  });

  it('does not revoke URL on unmount when previewUrl is undefined', () => {
    mockResource = mockNonBinaryResource;
    const { unmount } = renderHook(() => useFilePreview('https://pod.example/file.png'));
    unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
