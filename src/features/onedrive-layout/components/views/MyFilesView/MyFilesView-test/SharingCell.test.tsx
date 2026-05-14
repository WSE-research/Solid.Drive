import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseSharingLabel = vi.fn();
vi.mock('@/features/onedrive-layout/hooks/useSharingLabel', () => ({
  useSharingLabel: (uri: string) => mockUseSharingLabel(uri),
}));

const mockUseSubject = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useResource: (uri: string) => ({ uri }),
  useSubject: (_shape: unknown, webId: string) => mockUseSubject(webId),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string | object, vars?: { count?: number }) => {
      const fb =
        typeof fallback === 'string'
          ? fallback
          : (fallback as { defaultValue?: string })?.defaultValue ?? key;
      if (vars && typeof vars.count === 'number') {
        return fb.replace('{{count}}', String(vars.count));
      }
      return fb;
    },
  ],
}));

import { SharingCell } from '../MyFilesView-file/SharingCell';

describe('SharingCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSubject.mockReturnValue(undefined);
  });

  it('renders an ellipsis while the sharing label is loading', () => {
    mockUseSharingLabel.mockReturnValue({
      kind: 'private',
      agentWebIds: [],
      loading: true,
    });
    const { container } = render(<SharingCell uri="https://pod/a/" />);
    expect(container.querySelector('.odl-sharing-cell--loading')).toBeInTheDocument();
    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('renders "Public" when the resource is public', () => {
    mockUseSharingLabel.mockReturnValue({
      kind: 'public',
      agentWebIds: [],
      loading: false,
    });
    render(<SharingCell uri="https://pod/a/" />);
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('renders the agent display name for a single shared agent', () => {
    mockUseSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: ['https://alice.example/profile/card#me'],
      loading: false,
    });
    mockUseSubject.mockReturnValue({ fn: 'Alice', name: 'Alice Doe' });
    render(<SharingCell uri="https://pod/a/" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('falls back to vcard:fn missing → foaf:name when fn is undefined', () => {
    mockUseSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: ['https://alice.example/profile/card#me'],
      loading: false,
    });
    mockUseSubject.mockReturnValue({ name: 'Alice Doe' });
    render(<SharingCell uri="https://pod/a/" />);
    expect(screen.getByText('Alice Doe')).toBeInTheDocument();
  });

  it('falls back to the raw WebID when no profile is loaded', () => {
    const webId = 'https://alice.example/profile/card#me';
    mockUseSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: [webId],
      loading: false,
    });
    mockUseSubject.mockReturnValue(undefined);
    render(<SharingCell uri="https://pod/a/" />);
    expect(screen.getByText(webId)).toBeInTheDocument();
  });

  it('renders "{N} people" when the resource is shared with multiple agents', () => {
    mockUseSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: ['https://alice.example/#me', 'https://bob.example/#me'],
      loading: false,
    });
    render(<SharingCell uri="https://pod/a/" />);
    expect(screen.getByText('2 people')).toBeInTheDocument();
  });

  it('renders "Private" by default for non-public, non-shared resources', () => {
    mockUseSharingLabel.mockReturnValue({
      kind: 'private',
      agentWebIds: [],
      loading: false,
    });
    render(<SharingCell uri="https://pod/a/" />);
    expect(screen.getByText('Private')).toBeInTheDocument();
  });
});
