import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

const mockSession: { current: { webId?: string } } = {
  current: { webId: 'https://owner.example/profile/card#me' },
};
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: mockSession.current }),
  useSubject: () => null,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

const mockDriveState: { current: { storageRootUri: string | undefined } } = {
  current: { storageRootUri: 'https://owner.example/' },
};
vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => mockDriveState.current,
}));

const mockResolveCatalogUri = vi.fn<() => string | null>();
vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => mockResolveCatalogUri(),
}));

vi.mock('../RequestsView-file/RequestsList', () => ({
  RequestsList: () => <div data-testid="requests-list" />,
}));

import { RequestsView } from '../RequestsView-file/RequestsView';

describe('RequestsView', () => {
  beforeEach(() => {
    mockSession.current = { webId: 'https://owner.example/profile/card#me' };
    mockDriveState.current = { storageRootUri: 'https://owner.example/' };
    mockResolveCatalogUri.mockReset();
    mockResolveCatalogUri.mockReturnValue(
      'https://owner.example/my-solid-app/catalog.ttl',
    );
  });

  it('renders the RequestsList once storage and catalog are resolved', () => {
    render(<RequestsView />);
    expect(screen.getByTestId('requests-list')).toBeInTheDocument();
  });

  it('shows the connecting placeholder while storage root is unknown', () => {
    mockDriveState.current = { storageRootUri: undefined };
    render(<RequestsView />);
    expect(screen.queryByTestId('requests-list')).not.toBeInTheDocument();
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('shows the connecting placeholder while catalog URI is unknown', () => {
    mockResolveCatalogUri.mockReturnValue(null);
    render(<RequestsView />);
    expect(screen.queryByTestId('requests-list')).not.toBeInTheDocument();
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });
});
