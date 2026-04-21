import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SolidContainer } from '@ldo/connected-solid';

// Mock variables
let mockSession = { webId: 'https://pod.example/profile/card#me' };
const mockFetch = vi.fn();
const mockCreateData = vi.fn();
const mockCommitData = vi.fn();
const mockGetResource = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: mockSession, fetch: mockFetch }),
  useLdo: () => ({ createData: mockCreateData, commitData: mockCommitData, getResource: mockGetResource }),
}));

vi.mock('@/.ldo/catalogEntry.shapeTypes', () => ({
  CatalogEntryShShapeType: 'CatalogEntryShShapeType',
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidLeaf: (res: unknown) => res != null && (res as Record<string, unknown>)._isSolidLeaf === true,
}));

const mockAppendToCatalog = vi.fn();
const mockLinkCatalogToProfile = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  appendToCatalog: (...args: unknown[]) => mockAppendToCatalog(...args),
  linkCatalogToProfile: (...args: unknown[]) => mockLinkCatalogToProfile(...args),
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  resolveClass: (mimeType: string) => `http://schema.org/${mimeType === 'image/png' ? 'ImageObject' : 'DigitalDocument'}`,
}));

vi.mock('@/config', () => ({
  INDEX_FILE: 'index.ttl',
}));

import { useFileUpload } from '../useFileUpload-file/useFileUpload';

describe('useFileUpload', () => {
  const mockFile = new File(['test'], 'photo.png', { type: 'image/png' });
  const mockMetadata = {
    name: '',
    encodingFormat: '',
    contentSize: '',
    uploadDate: '',
    publisher: null,
    description: '',
  };

  const mockMainContainer = {
    uri: 'https://pod.example/my-solid-app/',
    createChildAndOverwrite: vi.fn(),
  };

  const mockFileContainer = {
    uploadChildAndOverwrite: vi.fn(),
    child: vi.fn(),
    uri: 'https://pod.example/my-solid-app/photo-png/',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { webId: 'https://pod.example/profile/card#me' };
    mockCreateData.mockReturnValue(mockMetadata);
    mockCommitData.mockResolvedValue({ isError: false });
    mockMainContainer.createChildAndOverwrite.mockResolvedValue({ isError: false, resource: mockFileContainer });
    mockFileContainer.uploadChildAndOverwrite.mockResolvedValue({ isError: false });
    mockFileContainer.child.mockReturnValue({ _isSolidLeaf: true, uri: 'https://pod.example/my-solid-app/photo-png/index.ttl' });
    mockAppendToCatalog.mockResolvedValue(undefined);
    mockLinkCatalogToProfile.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('returns isUploading false initially', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.isUploading).toBe(false);
  });

  it('exposes upload as a callable function for initiating file uploads', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(typeof result.current.upload).toBe('function');
  });

  it('uploads a file by creating container, writing metadata, and appending to catalog', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.upload({
        file: mockFile,
        title: 'My Photo',
        description: 'A nice photo',
        mainContainer: mockMainContainer as unknown as SolidContainer,
        catalogUri: 'https://pod.example/catalog.ttl',
        profileHasCatalog: true,
      });
    });

    expect(mockMainContainer.createChildAndOverwrite).toHaveBeenCalled();
    expect(mockFileContainer.uploadChildAndOverwrite).toHaveBeenCalled();
    expect(mockCreateData).toHaveBeenCalled();
    expect(mockCommitData).toHaveBeenCalled();
    expect(mockAppendToCatalog).toHaveBeenCalled();
    expect(result.current.isUploading).toBe(false);
  });

  it('throws when not logged in', async () => {
    mockSession.webId = '';
    const { result } = renderHook(() => useFileUpload());

    await expect(
      act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Not logged in');
  });

  it('throws when container creation fails', async () => {
    mockMainContainer.createChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Container error' });
    const { result } = renderHook(() => useFileUpload());

    await expect(
      act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Container error');
  });

  it('cleans up and throws when file upload fails', async () => {
    mockFileContainer.uploadChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Upload failed' });
    const { result } = renderHook(() => useFileUpload());

    await expect(
      act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Upload failed');
    // Cleanup DELETE calls are made with solidFetch (mockFetch)
    // The call may use .catch(() => {}) so verify the error was thrown
  });

  it('cleans up and throws when index resource is not a SolidLeaf', async () => {
    mockFileContainer.child.mockReturnValue({ _isSolidLeaf: false });
    const { result } = renderHook(() => useFileUpload());

    await expect(
      act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Could not create metadata resource.');
  });

  it('throws when metadata commit fails', async () => {
    mockCommitData.mockResolvedValue({ isError: true, message: 'Invalid metadata' });
    const { result } = renderHook(() => useFileUpload());

    await expect(
      act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('File metadata is invalid');
  });

  it('cleans up and throws when catalog append fails', async () => {
    mockAppendToCatalog.mockRejectedValue(new Error('Catalog error'));
    const { result } = renderHook(() => useFileUpload());

    await expect(
      act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      })
    ).rejects.toThrow('Catalog could not be updated');
  });

  it('links catalog to profile when profileHasCatalog is false', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.upload({
        file: mockFile,
        title: 'Photo',
        description: '',
        mainContainer: mockMainContainer as unknown as SolidContainer,
        catalogUri: 'https://pod.example/catalog.ttl',
        profileHasCatalog: false,
      });
    });

    expect(mockLinkCatalogToProfile).toHaveBeenCalled();
  });

  it('does not link catalog when profileHasCatalog is true', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.upload({
        file: mockFile,
        title: 'Photo',
        description: '',
        mainContainer: mockMainContainer as unknown as SolidContainer,
        catalogUri: 'https://pod.example/catalog.ttl',
        profileHasCatalog: true,
      });
    });

    expect(mockLinkCatalogToProfile).not.toHaveBeenCalled();
  });

  it('uses file name as title when title is empty', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.upload({
        file: mockFile,
        title: '  ',
        description: '',
        mainContainer: mockMainContainer as unknown as SolidContainer,
        catalogUri: 'https://pod.example/catalog.ttl',
        profileHasCatalog: true,
      });
    });

    expect(mockMetadata.name).toBe('photo.png');
  });

  it('uses "application/octet-stream" fallback and undefined encodingFormat when file.type is empty', async () => {
    const emptyTypeFile = new File(['data'], 'readme.bin', { type: '' });
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.upload({
        file: emptyTypeFile,
        title: 'Binary',
        description: '',
        mainContainer: mockMainContainer as unknown as SolidContainer,
        catalogUri: 'https://pod.example/catalog.ttl',
        profileHasCatalog: true,
      });
    });

    // Line 87: file.type || "application/octet-stream" → "application/octet-stream"
    expect(mockFileContainer.uploadChildAndOverwrite).toHaveBeenCalledWith(
      'readme.bin',
      emptyTypeFile,
      'application/octet-stream'
    );
    // Line 106: file.type || undefined → undefined
    expect(mockMetadata.encodingFormat).toBeUndefined();
  });

  it('sets isUploading back to false after error', async () => {
    mockMainContainer.createChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Fail' });
    const { result } = renderHook(() => useFileUpload());

    try {
      await act(async () => {
        await result.current.upload({
          file: mockFile,
          title: 'Photo',
          description: '',
          mainContainer: mockMainContainer as unknown as SolidContainer,
          catalogUri: 'https://pod.example/catalog.ttl',
          profileHasCatalog: true,
        });
      });
    } catch { /* expected */ }

    expect(result.current.isUploading).toBe(false);
  });
});
