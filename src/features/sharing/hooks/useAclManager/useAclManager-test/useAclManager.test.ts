import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockFetch = vi.fn();
const mockDiscoverAclUri = vi.fn();
const mockReadAclAgents = vi.fn();
const mockWriteAcl = vi.fn();
const mockWriteListOnlyAcl = vi.fn();
const mockWriteResourceAcl = vi.fn();
const mockAppendToCatalog = vi.fn();
const mockRemoveFromCatalog = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock('@/infrastructure/wac/aclManager', () => ({
  discoverAclUri: (...args: any[]) => mockDiscoverAclUri(...args),
  readAclAgents: (...args: any[]) => mockReadAclAgents(...args),
  writeAcl: (...args: any[]) => mockWriteAcl(...args),
  writeListOnlyAcl: (...args: any[]) => mockWriteListOnlyAcl(...args),
  writeResourceAcl: (...args: any[]) => mockWriteResourceAcl(...args),
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  appendToCatalog: (...args: any[]) => mockAppendToCatalog(...args),
  removeFromCatalog: (...args: any[]) => mockRemoveFromCatalog(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getCandidateSharedCatalogUris: (_appUri: string, contactWebId: string) => [`https://pod.example/my-solid-app/.shared-${encodeURIComponent(contactWebId)}.ttl`],
  getSharedCatalogUri: (appUri: string, contactWebId: string) => `${appUri}.shared-${encodeURIComponent(contactWebId)}.ttl`,
}));

import { useAclManager } from '../useAclManager-file/useAclManager';

const containerUri = 'https://pod.example/my-solid-app/files/doc/';
const catalogUri = 'https://pod.example/my-solid-app/catalog.ttl';
const appContainerUri = 'https://pod.example/my-solid-app/';
const ownerWebId = 'https://pod.example/profile/card#me';
const sharedEntry = {
  metadataUri: 'https://pod.example/my-solid-app/files/doc/index.ttl',
  binaryUri: 'https://pod.example/my-solid-app/files/doc/file.pdf',
  classUri: 'http://schema.org/DigitalDocument',
  mediaType: 'application/pdf',
  byteSize: 1024,
  title: 'Test File',
  description: 'A test file',
  modified: '2024-01-01T00:00:00Z',
};

describe('useAclManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverAclUri.mockResolvedValue('https://pod.example/my-solid-app/files/doc/.acl');
    mockReadAclAgents.mockResolvedValue([]);
    mockWriteAcl.mockResolvedValue(undefined);
    mockWriteListOnlyAcl.mockResolvedValue(undefined);
    mockWriteResourceAcl.mockResolvedValue(undefined);
    mockAppendToCatalog.mockResolvedValue(undefined);
    mockRemoveFromCatalog.mockResolvedValue(undefined);
  });

  it('is defined', () => {
    expect(useAclManager).toBeDefined();
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );
    expect(result.current).toHaveProperty('aclUri');
    expect(result.current).toHaveProperty('grantees');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isSaving');
    expect(result.current).toHaveProperty('loadAcl');
    expect(result.current).toHaveProperty('grant');
    expect(result.current).toHaveProperty('revoke');
  });

  it('loading is initially true', () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );
    expect(result.current.loading).toBe(true);
  });

  it('loadAcl discovers ACL URI and reads grantees', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    expect(result.current.aclUri).toBe('https://pod.example/my-solid-app/files/doc/.acl');
    expect(result.current.grantees).toEqual(['https://alice.example/profile/card#me']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loadAcl syncs shared catalog for each grantee', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    expect(mockAppendToCatalog).toHaveBeenCalled();
  });

  it('loadAcl sets error on failure', async () => {
    mockDiscoverAclUri.mockRejectedValue(new Error('ACL not found'));
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    expect(result.current.error).toBe('ACL not found');
    expect(result.current.loading).toBe(false);
  });

  it('grant adds a grantee and writes ACL', async () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    // First load the ACL
    await act(async () => {
      await result.current.loadAcl();
    });

    await act(async () => {
      await result.current.grant('https://bob.example/profile/card#me');
    });

    expect(mockWriteAcl).toHaveBeenCalled();
    expect(result.current.grantees).toContain('https://bob.example/profile/card#me');
    expect(result.current.isSaving).toBe(false);
  });

  it('grant does nothing when aclUri is null', async () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    // Don't load ACL, so aclUri is null
    await act(async () => {
      await result.current.grant('https://bob.example/profile/card#me');
    });

    expect(mockWriteAcl).not.toHaveBeenCalled();
  });

  it('grant sets error on failure', async () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    mockWriteAcl.mockRejectedValue(new Error('Write failed'));
    await act(async () => {
      await result.current.grant('https://bob.example/profile/card#me');
    });

    expect(result.current.error).toBe('Write failed');
    expect(result.current.isSaving).toBe(false);
  });

  it('revoke removes a grantee and writes ACL', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    await act(async () => {
      await result.current.revoke('https://alice.example/profile/card#me');
    });

    expect(mockWriteAcl).toHaveBeenCalled();
    expect(result.current.grantees).not.toContain('https://alice.example/profile/card#me');
    expect(mockRemoveFromCatalog).toHaveBeenCalled();
  });

  it('revoke does nothing when aclUri is null', async () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.revoke('https://alice.example/profile/card#me');
    });

    expect(mockWriteAcl).not.toHaveBeenCalled();
  });

  it('revoke sets error on failure', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    mockWriteAcl.mockRejectedValue(new Error('Revoke failed'));
    await act(async () => {
      await result.current.revoke('https://alice.example/profile/card#me');
    });

    expect(result.current.error).toBe('Revoke failed');
    expect(result.current.isSaving).toBe(false);
  });

  it('removeLegacyDiscoveryAccess catches app ACL error without blocking', async () => {
    const contactWebId = 'https://alice.example/profile/card#me';
    mockReadAclAgents.mockResolvedValue([contactWebId]);
    // Call sequence: 1) container ACL, 2) shared catalog ACL (syncSharedCatalog), 3) app ACL (removeLegacy) → throw
    mockDiscoverAclUri
      .mockResolvedValueOnce('https://pod.example/my-solid-app/files/doc/.acl')
      .mockResolvedValueOnce('https://pod.example/my-solid-app/.shared.acl')
      .mockRejectedValueOnce(new Error('app acl fail'));
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    // Should succeed despite the error in app ACL discovery
    expect(result.current.error).toBeNull();
    expect(result.current.grantees).toEqual([contactWebId]);
  });

  it('removeLegacyDiscoveryAccess catches catalog ACL error without blocking', async () => {
    const contactWebId = 'https://alice.example/profile/card#me';
    mockReadAclAgents
      .mockResolvedValueOnce([contactWebId])  // container grantees
      .mockResolvedValueOnce([contactWebId]); // app ACL agents
    mockDiscoverAclUri
      .mockResolvedValueOnce('https://pod.example/my-solid-app/files/doc/.acl') // container
      .mockResolvedValueOnce('https://pod.example/my-solid-app/.acl')           // shared catalog ACL for syncSharedCatalog
      .mockResolvedValueOnce('https://pod.example/my-solid-app/.acl')           // app ACL
      .mockRejectedValueOnce(new Error('catalog acl fail'));                     // catalog ACL → throw
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.grantees).toEqual([contactWebId]);
  });

  it('removeLegacyDiscoveryAccess skips writeListOnlyAcl when app agents unchanged', async () => {
    const contactWebId = 'https://alice.example/profile/card#me';
    mockReadAclAgents
      .mockResolvedValueOnce([contactWebId])   // container grantees
      .mockResolvedValueOnce([]);              // app ACL agents — none match contactWebId, so filter removes nothing
    mockDiscoverAclUri
      .mockResolvedValueOnce('https://pod.example/my-solid-app/files/doc/.acl')
      .mockResolvedValueOnce('https://pod.example/my-solid-app/.shared.acl')   // shared catalog ACL
      .mockResolvedValueOnce('https://pod.example/my-solid-app/.acl')          // app ACL
      .mockResolvedValueOnce('https://pod.example/my-solid-app/catalog.acl');  // catalog ACL

    // catalog agents also empty — no match
    mockReadAclAgents.mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    expect(mockWriteListOnlyAcl).not.toHaveBeenCalled();
    // writeResourceAcl is called for sharedCatalog but NOT for catalog legacy cleanup
    const catalogLegacyCalls = mockWriteResourceAcl.mock.calls.filter(
      (call: any[]) => call[1] === catalogUri
    );
    expect(catalogLegacyCalls).toHaveLength(0);
  });

  it('loadAcl sets error as String for non-Error thrown', async () => {
    mockDiscoverAclUri.mockRejectedValue('string error');
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );

    await act(async () => {
      await result.current.loadAcl();
    });

    expect(result.current.error).toBe('string error');
  });

  it('grant sets error as String for non-Error thrown', async () => {
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );
    await act(async () => { await result.current.loadAcl(); });

    mockWriteAcl.mockRejectedValue(42);
    await act(async () => {
      await result.current.grant('https://bob.example/profile/card#me');
    });

    expect(result.current.error).toBe('42');
  });

  it('revoke sets error as String for non-Error thrown', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderHook(() =>
      useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry)
    );
    await act(async () => { await result.current.loadAcl(); });

    mockWriteAcl.mockRejectedValue({ code: 403 });
    await act(async () => {
      await result.current.revoke('https://alice.example/profile/card#me');
    });

    expect(result.current.error).toBe('[object Object]');
  });
});
