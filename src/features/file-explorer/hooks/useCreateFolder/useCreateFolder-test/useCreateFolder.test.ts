import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SolidContainer } from '@ldo/connected-solid';

const mockWebId = 'https://pod.example/profile/card#me';
const mockSolidFetch = vi.fn();
const mockSession: { webId: string | undefined } = { webId: mockWebId };
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: mockSession, fetch: mockSolidFetch }),
}));

const mockAppendFolderToCatalog = vi.fn();
const mockLinkCatalogToProfile = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  appendFolderToCatalog: (...args: unknown[]) => mockAppendFolderToCatalog(...args),
  linkCatalogToProfile: (...args: unknown[]) => mockLinkCatalogToProfile(...args),
}));

const mockNotifyCatalogChanged = vi.fn();
vi.mock('@/shared/hooks/useCatalogVersion', () => ({
  notifyCatalogChanged: (...args: unknown[]) => mockNotifyCatalogChanged(...args),
}));

import { validateFolderName, useCreateFolder } from '../useCreateFolder-file/useCreateFolder';

describe('validateFolderName', () => {
  it('returns error key for empty string', () => {
    expect(validateFolderName('')).toBe('fileExplorer.newFolderEmpty');
  });

  it('returns error key for whitespace-only string', () => {
    expect(validateFolderName('   ')).toBe('fileExplorer.newFolderEmpty');
  });

  it('returns error key for name containing "/"', () => {
    expect(validateFolderName('my/folder')).toBe('fileExplorer.newFolderInvalidChars');
  });

  it('returns error key for name containing "\\"', () => {
    expect(validateFolderName('my\\folder')).toBe('fileExplorer.newFolderInvalidChars');
  });

  it('returns error key for name containing ":"', () => {
    expect(validateFolderName('my:folder')).toBe('fileExplorer.newFolderInvalidChars');
  });

  it('returns null for valid name "my-folder"', () => {
    expect(validateFolderName('my-folder')).toBeNull();
  });

  it('returns null for valid name with surrounding whitespace', () => {
    expect(validateFolderName('  my folder  ')).toBeNull();
  });
});

describe('useCreateFolder', () => {
  const catalogUri = 'https://pod.example/catalog.ttl';
  const mockCreateChildAndOverwrite = vi.fn();

  const mockParentContainer = {
    uri: 'https://pod.example/my-solid-app/',
    createChildAndOverwrite: mockCreateChildAndOverwrite,
  } as unknown as SolidContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.webId = mockWebId;
    mockSolidFetch.mockResolvedValue({ ok: true });
    mockAppendFolderToCatalog.mockResolvedValue(undefined);
    mockLinkCatalogToProfile.mockResolvedValue(undefined);
  });

  it('calls createChildAndOverwrite with slug "my-new-folder/" for name "My New Folder"', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My New Folder',
        catalogUri,
        profileHasCatalog: true,
      });
    });

    expect(mockCreateChildAndOverwrite).toHaveBeenCalledWith('my-new-folder/');
  });

  it('registers the folder in the catalog with the typed name as the title', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: '  My New Folder  ',
        catalogUri,
        profileHasCatalog: true,
      });
    });

    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith({
      catalogUri,
      folderUri: 'https://pod.example/my-solid-app/my-new-folder/',
      parentUri: mockParentContainer.uri,
      title: 'My New Folder',
      modified: expect.any(String),
      publisherWebId: mockWebId,
      fetch: mockSolidFetch,
    });
  });

  it('resolves to the new folder URI', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    let folderUri: string | undefined;
    await act(async () => {
      folderUri = await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My Folder',
        catalogUri,
        profileHasCatalog: true,
      });
    });

    expect(folderUri).toBe('https://pod.example/my-solid-app/my-folder/');
  });

  it('notifies catalog listeners after a successful create', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My Folder',
        catalogUri,
        profileHasCatalog: true,
      });
    });

    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(catalogUri);
  });

  it('links the catalog to the profile when profileHasCatalog is false', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My Folder',
        catalogUri,
        profileHasCatalog: false,
      });
    });

    expect(mockLinkCatalogToProfile).toHaveBeenCalledWith(catalogUri, mockWebId, mockSolidFetch);
  });

  it('does not link the catalog to the profile when it is already linked', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My Folder',
        catalogUri,
        profileHasCatalog: true,
      });
    });

    expect(mockLinkCatalogToProfile).not.toHaveBeenCalled();
  });

  it('throws when result.isError is true', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Creation failed', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await expect(
      act(async () => {
        await result.current.createFolder({
          parentContainer: mockParentContainer,
          folderName: 'My Folder',
          catalogUri,
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Creation failed');
    expect(mockAppendFolderToCatalog).not.toHaveBeenCalled();
  });

  it('removes the folder and throws when the catalog write fails', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    mockAppendFolderToCatalog.mockRejectedValue(new Error('Catalog PATCH failed'));

    const { result } = renderHook(() => useCreateFolder());

    await expect(
      act(async () => {
        await result.current.createFolder({
          parentContainer: mockParentContainer,
          folderName: 'My Folder',
          catalogUri,
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Catalog PATCH failed');

    expect(mockSolidFetch).toHaveBeenCalledWith(
      'https://pod.example/my-solid-app/my-folder/',
      { method: 'DELETE' },
    );
    expect(mockNotifyCatalogChanged).not.toHaveBeenCalled();
  });

  it('still throws the original catalog error when the rollback DELETE itself fails', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    mockAppendFolderToCatalog.mockRejectedValue(new Error('Catalog PATCH failed'));
    mockSolidFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCreateFolder());

    await expect(
      act(async () => {
        await result.current.createFolder({
          parentContainer: mockParentContainer,
          folderName: 'My Folder',
          catalogUri,
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Catalog PATCH failed');
  });

  it('does not throw when linking the catalog to the profile fails', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    mockLinkCatalogToProfile.mockRejectedValue(new Error('Profile PATCH failed'));

    const { result } = renderHook(() => useCreateFolder());

    let folderUri: string | undefined;
    await act(async () => {
      folderUri = await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My Folder',
        catalogUri,
        profileHasCatalog: false,
      });
    });

    expect(folderUri).toBe('https://pod.example/my-solid-app/my-folder/');
  });

  it('throws "Not logged in" when there is no webId', async () => {
    mockSession.webId = undefined;
    const { result } = renderHook(() => useCreateFolder());

    await expect(
      act(async () => {
        await result.current.createFolder({
          parentContainer: mockParentContainer,
          folderName: 'My Folder',
          catalogUri,
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Not logged in');
    expect(mockCreateChildAndOverwrite).not.toHaveBeenCalled();
  });

  it('sets isCreating to false after success', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder({
        parentContainer: mockParentContainer,
        folderName: 'My Folder',
        catalogUri,
        profileHasCatalog: true,
      });
    });

    expect(result.current.isCreating).toBe(false);
  });

  it('sets isCreating to false after failure', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Fail', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    try {
      await act(async () => {
        await result.current.createFolder({
          parentContainer: mockParentContainer,
          folderName: 'My Folder',
          catalogUri,
          profileHasCatalog: true,
        });
      });
    } catch { /* expected */ }

    expect(result.current.isCreating).toBe(false);
  });
});
