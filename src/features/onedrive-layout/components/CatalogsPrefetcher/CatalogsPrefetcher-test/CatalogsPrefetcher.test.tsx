import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const mockUseSharedCatalog = vi.fn();
vi.mock('@/features/file-explorer/hooks/useSharedCatalog', () => ({
  useSharedCatalog: (...args: unknown[]) => {
    mockUseSharedCatalog(...args);
    return {
      sharedEntries: [],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: false,
      isProfileLoading: false,
    };
  },
}));

import { CatalogsPrefetcher } from '../CatalogsPrefetcher-file/CatalogsPrefetcher';

beforeEach(() => {
  mockUseSharedCatalog.mockReset();
});

describe('CatalogsPrefetcher', () => {
  it('renders no DOM', () => {
    const { container } = render(
      <CatalogsPrefetcher
        contacts={['https://alice/me', 'https://bob/me']}
        viewerWebId="https://viewer/me"
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('mounts both directions of useSharedCatalog per contact', () => {
    render(
      <CatalogsPrefetcher
        contacts={['https://alice/me']}
        viewerWebId="https://viewer/me"
      />,
    );
    // with-you: (contact, viewer); by-you: (viewer, contact)
    expect(mockUseSharedCatalog).toHaveBeenCalledWith(
      'https://alice/me',
      'https://viewer/me',
    );
    expect(mockUseSharedCatalog).toHaveBeenCalledWith(
      'https://viewer/me',
      'https://alice/me',
    );
    expect(mockUseSharedCatalog).toHaveBeenCalledTimes(2);
  });

  it('fires N×2 calls for N contacts', () => {
    render(
      <CatalogsPrefetcher
        contacts={['https://a/me', 'https://b/me', 'https://c/me']}
        viewerWebId="https://viewer/me"
      />,
    );
    expect(mockUseSharedCatalog).toHaveBeenCalledTimes(6);
  });

  it('does nothing when viewerWebId is empty', () => {
    render(
      <CatalogsPrefetcher
        contacts={['https://alice/me']}
        viewerWebId=""
      />,
    );
    expect(mockUseSharedCatalog).not.toHaveBeenCalled();
  });

  it('does nothing when the contacts list is empty', () => {
    render(
      <CatalogsPrefetcher contacts={[]} viewerWebId="https://viewer/me" />,
    );
    expect(mockUseSharedCatalog).not.toHaveBeenCalled();
  });
});
