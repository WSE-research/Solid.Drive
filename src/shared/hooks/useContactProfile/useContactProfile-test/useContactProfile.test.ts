import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

let mockProfile: Record<string, unknown> | null = null;
let mockResource: Record<string, unknown> | null = { isLoading: () => false };
let lastResourceUri: string | undefined;

vi.mock('@ldo/solid-react', () => ({
  useResource: (uri: string) => {
    lastResourceUri = uri;
    return mockResource;
  },
  useSubject: () => mockProfile,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

import { useContactProfile } from '../useContactProfile-file/useContactProfile';

describe('useContactProfile', () => {
  it('strips the WebID fragment when fetching the profile document', () => {
    mockProfile = null;
    mockResource = { isLoading: () => false };
    renderHook(() => useContactProfile('https://alice.example/profile/card#me'));
    expect(lastResourceUri).toBe('https://alice.example/profile/card');
  });

  it('returns vcard:fn as displayName when present', () => {
    mockProfile = { fn: 'Alice Liddell' };
    mockResource = { isLoading: () => false };
    const { result } = renderHook(() =>
      useContactProfile('https://alice.example/profile/card#me'),
    );
    expect(result.current.displayName).toBe('Alice Liddell');
    expect(result.current.initial).toBe('A');
  });

  it('falls back to the WebID-derived name when fn and name are missing', () => {
    mockProfile = {};
    mockResource = { isLoading: () => false };
    const { result } = renderHook(() =>
      useContactProfile('https://aurora-salvatore.solidcommunity.net/profile/card#me'),
    );
    expect(result.current.displayName).toBe('aurora-salvatore');
    expect(result.current.initial).toBe('A');
  });

  it('exposes the foaf:img URL as avatarUrl', () => {
    mockProfile = { img: { '@id': 'https://avatar.example/photo.jpg' } };
    mockResource = { isLoading: () => false };
    const { result } = renderHook(() =>
      useContactProfile('https://alice.example/profile/card#me'),
    );
    expect(result.current.avatarUrl).toBe('https://avatar.example/photo.jpg');
  });

  it('reports isLoading while the profile resource is fetching', () => {
    mockProfile = null;
    mockResource = { isLoading: () => true };
    const { result } = renderHook(() =>
      useContactProfile('https://alice.example/profile/card#me'),
    );
    expect(result.current.isLoading).toBe(true);
  });

  it('reports isLoading false when the resource lacks an isLoading method', () => {
    mockProfile = null;
    mockResource = {};
    const { result } = renderHook(() =>
      useContactProfile('https://alice.example/profile/card#me'),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('reports isLoading false when the resource is null', () => {
    mockProfile = null;
    mockResource = null;
    const { result } = renderHook(() =>
      useContactProfile('https://alice.example/profile/card#me'),
    );
    expect(result.current.isLoading).toBe(false);
  });
});
