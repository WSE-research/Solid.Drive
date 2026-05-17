import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharingCell } from '../MyFilesView-file/SharingCell';

const mockSharingLabel = vi.fn();
const mockContactProfile = vi.fn();

vi.mock('@/features/onedrive-layout/hooks/useSharingLabel', () => ({
  useSharingLabel: () => mockSharingLabel(),
}));

vi.mock('@/shared/hooks/useContactProfile', () => ({
  useContactProfile: (webId: string) => mockContactProfile(webId),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string, vars?: Record<string, unknown>) => {
      if (vars?.count !== undefined && fallback) {
        return fallback.replace('{{count}}', String(vars.count));
      }
      return fallback ?? key;
    },
  ],
}));

describe('SharingCell', () => {
  beforeEach(() => {
    mockContactProfile.mockReturnValue({
      displayName: 'Alice',
      avatarUrl: undefined,
      initial: 'A',
      isLoading: false,
    });
  });

  it('renders an ellipsis placeholder while sharing data is loading', () => {
    mockSharingLabel.mockReturnValue({ kind: 'private', agentWebIds: [], loading: true });
    const { container } = render(<SharingCell uri="https://pod/x/" />);
    expect(container.querySelector('.odl-sharing-cell--loading')).toBeInTheDocument();
    expect(container.textContent).toContain('…');
  });

  it('renders "Private" when the resource has no non-owner grantees', () => {
    mockSharingLabel.mockReturnValue({ kind: 'private', agentWebIds: [], loading: false });
    render(<SharingCell uri="https://pod/x/" />);
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('renders "Public" when the resource is shared with foaf:Agent', () => {
    mockSharingLabel.mockReturnValue({ kind: 'public', agentWebIds: [], loading: false });
    render(<SharingCell uri="https://pod/x/" />);
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('renders the resolved display name for a single grantee', () => {
    mockSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: ['https://alice.example/profile/card#me'],
      loading: false,
    });
    render(<SharingCell uri="https://pod/x/" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByTitle('https://alice.example/profile/card#me')).toBeInTheDocument();
  });

  it('renders the count label for multi-agent shares', () => {
    mockSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: [
        'https://alice.example/profile/card#me',
        'https://bob.example/profile/card#me',
        'https://charlie.example/profile/card#me',
      ],
      loading: false,
    });
    render(<SharingCell uri="https://pod/x/" />);
    expect(screen.getByText('3 people')).toBeInTheDocument();
  });

  it('falls back to the count label when shared kind has zero agents', () => {
    mockSharingLabel.mockReturnValue({ kind: 'shared', agentWebIds: [], loading: false });
    render(<SharingCell uri="https://pod/x/" />);
    expect(screen.getByText('0 people')).toBeInTheDocument();
  });
});
