import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
let mockWebIdResource: any = { isLoading: () => false, reload: vi.fn() };
const mockProfile: any = {
  knows: { toArray: () => [{ '@id': 'https://alice.example/profile/card#me' }] },
};
const mockAddProfileContact = vi.fn();
const mockRemoveProfileContact = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
  useResource: () => mockWebIdResource,
  useSubject: () => mockProfile,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isReloadable: (res: any) => res && typeof res.reload === 'function',
}));

vi.mock('@/infrastructure/solid/profile', () => ({
  addContact: (...args: any[]) => mockAddProfileContact(...args),
  removeContact: (...args: any[]) => mockRemoveProfileContact(...args),
}));

let mockProfileOverride: any = undefined;

vi.mock('@ldo/solid-react', async () => {
  return {
    useSolidAuth: () => ({ fetch: mockFetch }),
    useResource: () => mockWebIdResource,
    useSubject: () => mockProfileOverride !== undefined ? mockProfileOverride : mockProfile,
  };
});

import { useContacts } from '../useContacts-file/useContacts';

const ownerWebId = 'https://pod.example/profile/card#me';

describe('useContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddProfileContact.mockResolvedValue(undefined);
    mockRemoveProfileContact.mockResolvedValue(undefined);
    mockWebIdResource = { isLoading: () => false, reload: vi.fn() };
    mockProfileOverride = undefined;
  });

  it('is defined', () => {
    expect(useContacts).toBeDefined();
  });

  it('returns contacts from profile', () => {
    const { result } = renderHook(() => useContacts(ownerWebId));
    expect(result.current.contacts).toEqual(['https://alice.example/profile/card#me']);
  });

  it('isAdding is initially false', () => {
    const { result } = renderHook(() => useContacts(ownerWebId));
    expect(result.current.isAdding).toBe(false);
  });

  it('addContact adds a new contact', async () => {
    const { result } = renderHook(() => useContacts(ownerWebId));

    await act(async () => {
      await result.current.addContact('https://bob.example/profile/card#me');
    });

    expect(mockAddProfileContact).toHaveBeenCalledWith(ownerWebId, 'https://bob.example/profile/card#me', mockFetch);
    expect(result.current.contacts).toContain('https://bob.example/profile/card#me');
    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('addContact trims whitespace', async () => {
    const { result } = renderHook(() => useContacts(ownerWebId));

    await act(async () => {
      await result.current.addContact('  https://bob.example/profile/card#me  ');
    });

    expect(mockAddProfileContact).toHaveBeenCalledWith(ownerWebId, 'https://bob.example/profile/card#me', mockFetch);
  });

  it('addContact throws for duplicate contact', async () => {
    const { result } = renderHook(() => useContacts(ownerWebId));

    await expect(
      act(async () => {
        await result.current.addContact('https://alice.example/profile/card#me');
      })
    ).rejects.toThrow('This contact is already in your list.');
  });

  it('addContact sets isAdding back to false after completion', async () => {
    const { result } = renderHook(() => useContacts(ownerWebId));

    await act(async () => {
      await result.current.addContact('https://bob.example/profile/card#me');
    });

    expect(result.current.isAdding).toBe(false);
  });

  it('addContact sets isAdding back to false on error', async () => {
    mockAddProfileContact.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useContacts(ownerWebId));

    try {
      await act(async () => {
        await result.current.addContact('https://bob.example/profile/card#me');
      });
    } catch {}

    expect(result.current.isAdding).toBe(false);
  });

  it('removeContact removes a contact', async () => {
    const { result } = renderHook(() => useContacts(ownerWebId));

    await act(async () => {
      await result.current.removeContact('https://alice.example/profile/card#me');
    });

    expect(mockRemoveProfileContact).toHaveBeenCalledWith(ownerWebId, 'https://alice.example/profile/card#me', mockFetch);
    expect(result.current.contacts).not.toContain('https://alice.example/profile/card#me');
    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('returns empty contacts when profile is null', () => {
    mockProfileOverride = null;
    const { result } = renderHook(() => useContacts(ownerWebId));
    expect(result.current.contacts).toEqual([]);
  });

  it('returns empty contacts when profile.knows is undefined', () => {
    mockProfileOverride = { knows: undefined };
    const { result } = renderHook(() => useContacts(ownerWebId));
    expect(result.current.contacts).toEqual([]);
  });
});
