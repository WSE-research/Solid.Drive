import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockSession = { webId: 'https://pod.example/profile/card#me' };
const mockFetch = vi.fn();
let mockWebIdResource: Record<string, unknown> = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
let mockProfile: Record<string, unknown> | null = {
  name: 'Test User',
  fn: 'Test FN',
  img: { '@id': 'https://pod.example/avatar.jpg' },
};
const mockSaveProfileFields = vi.fn();
const mockEnsureProfileDocType = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: mockSession, fetch: mockFetch }),
  useResource: () => mockWebIdResource,
  useSubject: () => mockProfile,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: (res: unknown) => res != null && typeof (res as Record<string, unknown>).isLoading === 'function',
  isReloadable: (res: unknown) => res != null && typeof (res as Record<string, unknown>).reload === 'function',
}));

vi.mock('@/infrastructure/solid/profile', () => ({
  saveProfileFields: (...args: unknown[]) => mockSaveProfileFields(...args),
  ensureProfileDocType: (...args: unknown[]) => mockEnsureProfileDocType(...args),
}));

import { useProfile } from '../useProfile-file/useProfile';

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveProfileFields.mockResolvedValue(undefined);
    mockEnsureProfileDocType.mockResolvedValue(undefined);
    mockWebIdResource = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
    mockProfile = {
      name: 'Test User',
      fn: 'Test FN',
      img: { '@id': 'https://pod.example/avatar.jpg' },
    };
    mockSession.webId = 'https://pod.example/profile/card#me';
  });

  it('exposes name, imgUrl, displayName, isLoading, setName, setImgUrl, save, and reload', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current).toHaveProperty('name');
    expect(result.current).toHaveProperty('imgUrl');
    expect(result.current).toHaveProperty('displayName');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('setName');
    expect(result.current).toHaveProperty('setImgUrl');
    expect(result.current).toHaveProperty('save');
    expect(result.current).toHaveProperty('reload');
  });

  it('returns name and imgUrl matching the profile data', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.name).toBe('Test User');
    expect(result.current.imgUrl).toBe('https://pod.example/avatar.jpg');
  });

  it('returns displayName equal to profile.name when name is set', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.displayName).toBe('Test User');
  });

  it('returns isLoading false when the resource is not loading', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.isLoading).toBe(false);
  });

  it('isLoading is true when resource is loading', () => {
    mockWebIdResource = { isLoading: () => true, reload: vi.fn() };
    const { result } = renderHook(() => useProfile());
    expect(result.current.isLoading).toBe(true);
  });

  it('setName updates the name state when called', () => {
    const { result } = renderHook(() => useProfile());
    act(() => {
      result.current.setName('New Name');
    });
    expect(result.current.name).toBe('New Name');
  });

  it('setImgUrl updates the imgUrl state when called', () => {
    const { result } = renderHook(() => useProfile());
    act(() => {
      result.current.setImgUrl('https://pod.example/new-avatar.jpg');
    });
    expect(result.current.imgUrl).toBe('https://pod.example/new-avatar.jpg');
  });

  it('save calls saveProfileFields and ensureProfileDocType', async () => {
    const { result } = renderHook(() => useProfile());
    const original = { name: 'Old Name', imgUrl: '' };

    await act(async () => {
      await result.current.save(original);
    });

    expect(mockSaveProfileFields).toHaveBeenCalled();
    expect(mockEnsureProfileDocType).toHaveBeenCalled();
    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('save does nothing when webId is empty', async () => {
    mockSession.webId = '';
    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.save({ name: '', imgUrl: '' });
    });

    expect(mockSaveProfileFields).not.toHaveBeenCalled();
  });

  it('reload calls the resource reload method', async () => {
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.reload();
    });
    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('returns empty name string when the suspendSync option is true', () => {
    const { result } = renderHook(() => useProfile({ suspendSync: true }));
    // Name should be empty string (default) because sync is suspended
    expect(result.current.name).toBe('');
  });

  it('displayName falls back to fn when name is absent', () => {
    mockProfile = { name: undefined, fn: 'FN Only', img: null };
    const { result } = renderHook(() => useProfile());
    expect(result.current.displayName).toBe('FN Only');
  });

  it('displayName is empty when neither name nor fn exist', () => {
    mockProfile = { name: undefined, fn: undefined, img: null };
    const { result } = renderHook(() => useProfile());
    expect(result.current.displayName).toBe('');
  });

  it('returns empty string for name when profile.name is null', () => {
    mockProfile = { name: null, fn: null, img: null };
    const { result } = renderHook(() => useProfile());
    expect(result.current.name).toBe('');
  });

  it('returns empty string for imgUrl when profile.img is null', () => {
    mockProfile = { name: 'Test', fn: null, img: null };
    const { result } = renderHook(() => useProfile());
    expect(result.current.imgUrl).toBe('');
  });

  it('returns empty strings for name, imgUrl, and displayName when profile is null', () => {
    mockProfile = null;
    const { result } = renderHook(() => useProfile());
    expect(result.current.name).toBe('');
    expect(result.current.imgUrl).toBe('');
    expect(result.current.displayName).toBe('');
  });

  it('save still completes after ensureProfileDocType fails, logging the error', async () => {
    mockEnsureProfileDocType.mockRejectedValue(new Error('doc type fail'));
    const { result } = renderHook(() => useProfile());
    const original = { name: 'Old', imgUrl: '' };
    // Should not throw — catch is swallowed
    await act(async () => {
      await result.current.save(original);
    });
    expect(mockSaveProfileFields).toHaveBeenCalled();
  });

  it('reload does nothing when resource is not reloadable', async () => {
    mockWebIdResource = { isLoading: () => false };
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.reload();
    });
    // No error thrown
  });
});
