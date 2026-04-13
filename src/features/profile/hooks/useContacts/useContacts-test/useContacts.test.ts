import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockFetch = vi.fn();
let mockWebIdResource: Record<string, unknown> = { isLoading: () => false, reload: vi.fn() };
const mockProfile: Record<string, unknown> = {
  knows: { toArray: () => [{ '@id': 'https://alice.example/profile/card#me' }] },
};
const mockAddProfileContact = vi.fn();
const mockRemoveProfileContact = vi.fn();
let mockProfileOverride: Record<string, unknown> | null | undefined = undefined;

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
  useResource: () => mockWebIdResource,
  useSubject: () => mockProfileOverride !== undefined ? mockProfileOverride : mockProfile,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isReloadable: (res: unknown) => res != null && typeof (res as Record<string, unknown>).reload === 'function',
}));

vi.mock('@/infrastructure/solid/profile', () => ({
  addContact: (...args: unknown[]) => mockAddProfileContact(...args),
  removeContact: (...args: unknown[]) => mockRemoveProfileContact(...args),
}));

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

  it('returns an array of contact WebIDs extracted from the user profile', () => {
    const { result } = renderHook(() => useContacts(ownerWebId));
    expect(result.current.contacts).toEqual(['https://alice.example/profile/card#me']);
  });

  it('isAdding is initially false before any addContact call', () => {
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
    } catch { /* expected */ }

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
