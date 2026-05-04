import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSharingLabel } from '../useSharingLabel-file/useSharingLabel';

const mockDiscoverAclUri = vi.fn();
const mockReadAclAgents = vi.fn();
vi.mock('@/infrastructure/wac/aclManager', () => ({
  discoverAclUri: (...args: unknown[]) => mockDiscoverAclUri(...args),
  readAclAgents: (...args: unknown[]) => mockReadAclAgents(...args),
}));

const fetchStub = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: 'https://owner/profile/card#me' }, fetch: fetchStub }),
}));

describe('useSharingLabel', () => {
  beforeEach(() => {
    mockDiscoverAclUri.mockReset();
    mockReadAclAgents.mockReset();
  });

  it('returns private when only the owner is in the ACL', async () => {
    mockDiscoverAclUri.mockResolvedValue('https://x/.acl');
    mockReadAclAgents.mockResolvedValue(['https://owner/profile/card#me']);
    const { result } = renderHook(() => useSharingLabel('https://x/file/'));
    await waitFor(() => expect(result.current.kind).toBe('private'));
    expect(result.current.agentWebIds).toEqual([]);
  });

  it('returns public when foaf:Agent is in the ACL', async () => {
    mockDiscoverAclUri.mockResolvedValue('https://x/.acl');
    mockReadAclAgents.mockResolvedValue([
      'https://owner/profile/card#me',
      'http://xmlns.com/foaf/0.1/Agent',
    ]);
    const { result } = renderHook(() => useSharingLabel('https://x/file/'));
    await waitFor(() => expect(result.current.kind).toBe('public'));
  });

  it('returns shared with non-owner agents listed', async () => {
    mockDiscoverAclUri.mockResolvedValue('https://x/.acl');
    mockReadAclAgents.mockResolvedValue([
      'https://owner/profile/card#me',
      'https://alice/me',
      'https://bob/me',
    ]);
    const { result } = renderHook(() => useSharingLabel('https://x/file/'));
    await waitFor(() => expect(result.current.kind).toBe('shared'));
    expect(result.current.agentWebIds).toEqual(['https://alice/me', 'https://bob/me']);
  });

  it('returns private when the URI is undefined', () => {
    const { result } = renderHook(() => useSharingLabel(undefined));
    expect(result.current.kind).toBe('private');
  });

  it('returns private when ACL discovery throws', async () => {
    mockDiscoverAclUri.mockRejectedValue(new Error('no acl'));
    const { result } = renderHook(() => useSharingLabel('https://x/file/'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kind).toBe('private');
  });

  it('reports loading: true while the ACL fetch is pending', () => {
    let resolveAcl!: (uri: string) => void;
    mockDiscoverAclUri.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveAcl = resolve;
      }),
    );
    const { result } = renderHook(() => useSharingLabel('https://x/file/'));
    expect(result.current.loading).toBe(true);
    resolveAcl('https://x/.acl');
  });
});
