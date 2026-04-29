import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockFetch = vi.fn();
const mockDiscoverAclUri = vi.fn();
const mockReadAclAgents = vi.fn();
const mockWriteAcl = vi.fn();
const mockWriteResourceAcl = vi.fn();
const mockEnsureDiscoveryAccess = vi.fn();
const mockAppendToCatalog = vi.fn();
const mockRemoveFromCatalog = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock('@/infrastructure/wac/aclManager', () => ({
  discoverAclUri: (...args: unknown[]) => mockDiscoverAclUri(...args),
  readAclAgents: (...args: unknown[]) => mockReadAclAgents(...args),
  writeAcl: (...args: unknown[]) => mockWriteAcl(...args),
  writeResourceAcl: (...args: unknown[]) => mockWriteResourceAcl(...args),
  ensureDiscoveryAccess: (...args: unknown[]) => mockEnsureDiscoveryAccess(...args),
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  appendToCatalog: (...args: unknown[]) => mockAppendToCatalog(...args),
  removeFromCatalog: (...args: unknown[]) => mockRemoveFromCatalog(...args),
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

const renderAclManager = () =>
  renderHook(() => useAclManager(containerUri, catalogUri, appContainerUri, ownerWebId, sharedEntry));

const doLoadAcl = async (result: ReturnType<typeof renderAclManager>['result']) => {
  await act(async () => { await result.current.loadAcl(); });
};

describe('useAclManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverAclUri.mockResolvedValue('https://pod.example/my-solid-app/files/doc/.acl');
    mockReadAclAgents.mockResolvedValue([]);
    mockWriteAcl.mockResolvedValue(undefined);
    mockWriteResourceAcl.mockResolvedValue(undefined);
    mockEnsureDiscoveryAccess.mockResolvedValue(undefined);
    mockAppendToCatalog.mockResolvedValue(undefined);
    mockRemoveFromCatalog.mockResolvedValue(undefined);
  });

  it('exposes all expected properties: aclUri, grantees, loading, error, isSaving, loadAcl, grant, and revoke', () => {
    const { result } = renderAclManager();
    expect(result.current).toHaveProperty('aclUri');
    expect(result.current).toHaveProperty('grantees');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isSaving');
    expect(result.current).toHaveProperty('loadAcl');
    expect(result.current).toHaveProperty('grant');
    expect(result.current).toHaveProperty('revoke');
  });

  it('returns loading as true before loadAcl is called', () => {
    const { result } = renderAclManager();
    expect(result.current.loading).toBe(true);
  });

  it('loadAcl discovers ACL URI and reads grantees', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderAclManager();
    await doLoadAcl(result);
    expect(result.current.aclUri).toBe('https://pod.example/my-solid-app/files/doc/.acl');
    expect(result.current.grantees).toEqual(['https://alice.example/profile/card#me']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loadAcl calls appendToCatalog for each grantee to sync the shared catalog', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderAclManager();
    await doLoadAcl(result);
    expect(mockAppendToCatalog).toHaveBeenCalled();
  });

  it('loadAcl sets error message when ACL discovery fails', async () => {
    mockDiscoverAclUri.mockRejectedValue(new Error('ACL not found'));
    const { result } = renderAclManager();
    await doLoadAcl(result);
    expect(result.current.error).toBe('ACL not found');
    expect(result.current.loading).toBe(false);
  });

  it('grant adds a grantee and writes ACL', async () => {
    const { result } = renderAclManager();
    await doLoadAcl(result);
    await act(async () => { await result.current.grant('https://bob.example/profile/card#me'); });
    expect(mockWriteAcl).toHaveBeenCalled();
    expect(result.current.grantees).toContain('https://bob.example/profile/card#me');
    expect(result.current.isSaving).toBe(false);
  });

  it('grant delegates discovery access setup so the contact can browse other available items', async () => {
    const { result } = renderAclManager();
    await doLoadAcl(result);
    mockEnsureDiscoveryAccess.mockClear();
    await act(async () => { await result.current.grant('https://bob.example/profile/card#me'); });
    expect(mockEnsureDiscoveryAccess).toHaveBeenCalledWith(
      catalogUri,
      appContainerUri,
      ownerWebId,
      'https://bob.example/profile/card#me',
      mockFetch
    );
  });

  it('grant does nothing when aclUri is null', async () => {
    const { result } = renderAclManager();
    await act(async () => { await result.current.grant('https://bob.example/profile/card#me'); });
    expect(mockWriteAcl).not.toHaveBeenCalled();
  });

  it('grant sets error message when writeAcl throws', async () => {
    const { result } = renderAclManager();
    await doLoadAcl(result);
    mockWriteAcl.mockRejectedValue(new Error('Write failed'));
    await act(async () => { await result.current.grant('https://bob.example/profile/card#me'); });
    expect(result.current.error).toBe('Write failed');
    expect(result.current.isSaving).toBe(false);
  });

  it('revoke removes a grantee and writes ACL', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderAclManager();
    await doLoadAcl(result);
    await act(async () => { await result.current.revoke('https://alice.example/profile/card#me'); });
    expect(mockWriteAcl).toHaveBeenCalled();
    expect(result.current.grantees).not.toContain('https://alice.example/profile/card#me');
  });

  it('revoke leaves the per-viewer shared catalog intact so the entry stays visible as browsable on the requester side', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderAclManager();
    await doLoadAcl(result);
    mockRemoveFromCatalog.mockClear();
    await act(async () => { await result.current.revoke('https://alice.example/profile/card#me'); });
    expect(mockRemoveFromCatalog).not.toHaveBeenCalled();
  });

  it('revoke does nothing when aclUri is null', async () => {
    const { result } = renderAclManager();
    await act(async () => { await result.current.revoke('https://alice.example/profile/card#me'); });
    expect(mockWriteAcl).not.toHaveBeenCalled();
  });

  it('revoke sets error message when writeAcl throws', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderAclManager();
    await doLoadAcl(result);
    mockWriteAcl.mockRejectedValue(new Error('Revoke failed'));
    await act(async () => { await result.current.revoke('https://alice.example/profile/card#me'); });
    expect(result.current.error).toBe('Revoke failed');
    expect(result.current.isSaving).toBe(false);
  });

  it('loadAcl sets error as String for non-Error thrown', async () => {
    mockDiscoverAclUri.mockRejectedValue('string error');
    const { result } = renderAclManager();
    await doLoadAcl(result);
    expect(result.current.error).toBe('string error');
  });

  it('grant sets error as String for non-Error thrown', async () => {
    const { result } = renderAclManager();
    await doLoadAcl(result);
    mockWriteAcl.mockRejectedValue(42);
    await act(async () => { await result.current.grant('https://bob.example/profile/card#me'); });
    expect(result.current.error).toBe('42');
  });

  it('revoke sets error as String for non-Error thrown', async () => {
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);
    const { result } = renderAclManager();
    await doLoadAcl(result);
    mockWriteAcl.mockRejectedValue({ code: 403 });
    await act(async () => { await result.current.revoke('https://alice.example/profile/card#me'); });
    expect(result.current.error).toBe('[object Object]');
  });
});
