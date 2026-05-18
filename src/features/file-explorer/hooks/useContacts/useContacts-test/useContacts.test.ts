import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let mockProfileOverride: Record<string, unknown> | null | undefined = undefined;

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: 'https://pod.example/profile/card#me' } }),
  useSubject: () => mockProfileOverride,
  useResource: () => undefined,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

import { useContacts } from '../useContacts-file/useContacts';

describe('useContacts', () => {
  beforeEach(() => {
    mockProfileOverride = {
      knows: {
        toArray: () => [
          { '@id': 'https://alice.example/profile/card#me' },
          { '@id': 'https://bob.example/profile/card#me' },
        ],
      },
    };
  });

  it('returns the WebID list from profile.knows', () => {
    const { result } = renderHook(() => useContacts());
    expect(result.current).toEqual([
      'https://alice.example/profile/card#me',
      'https://bob.example/profile/card#me',
    ]);
  });

  it('returns an empty list when the profile has not loaded yet', () => {
    mockProfileOverride = null;
    const { result } = renderHook(() => useContacts());
    expect(result.current).toEqual([]);
  });

  it('returns an empty list when the profile has no knows triples', () => {
    mockProfileOverride = { knows: undefined };
    const { result } = renderHook(() => useContacts());
    expect(result.current).toEqual([]);
  });

  it('returns a stable reference between renders for the same profile', () => {
    const { result, rerender } = renderHook(() => useContacts());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
