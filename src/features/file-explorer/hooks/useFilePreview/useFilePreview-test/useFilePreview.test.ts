import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilePreview } from '../useFilePreview-file/useFilePreview';

const mockBlob = new Blob(['test'], { type: 'image/png' });
const mockBinaryResource = {
  isBinary: () => true,
  getBlob: () => mockBlob,
};
const mockNonBinaryResource = {};
let mockResource: any = mockNonBinaryResource;

vi.mock('@ldo/solid-react', () => ({
  useResource: () => mockResource,
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isBinary: (res: any) => res && typeof res.isBinary === 'function',
}));

// Mock URL.createObjectURL and revokeObjectURL
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('useFilePreview', () => {
  beforeEach(() => {
    mockResource = mockNonBinaryResource;
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-id');
    URL.revokeObjectURL = vi.fn();
  });

  it('is defined', () => {
    expect(useFilePreview).toBeDefined();
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
    mockResource = undefined;
    const { result } = renderHook(() => useFilePreview(undefined));
    expect(result.current.previewUrl).toBeUndefined();
  });

  it('revokes URL on unmount', () => {
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
