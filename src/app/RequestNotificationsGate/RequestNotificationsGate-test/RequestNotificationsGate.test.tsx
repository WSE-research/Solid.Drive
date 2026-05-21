import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseSolidAuth = vi.fn();
const mockUseSubject = vi.fn();
const mockUseDriveInitialization = vi.fn();
const mockResolveCatalogUri = vi.fn();
const mockProvider = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => mockUseSolidAuth(),
  useSubject: (...args: unknown[]) => mockUseSubject(...args),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => mockUseDriveInitialization(),
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: (...args: unknown[]) => mockResolveCatalogUri(...args),
}));

vi.mock('@/features/profile/contexts/RequestNotificationsContext', () => ({
  RequestNotificationsProvider: (props: { children: React.ReactNode }) => {
    mockProvider(props);
    return <div data-testid="provider">{props.children}</div>;
  },
}));

import { RequestNotificationsGate } from '../RequestNotificationsGate-file/RequestNotificationsGate';

describe('RequestNotificationsGate', () => {
  beforeEach(() => {
    mockProvider.mockClear();
    mockUseSubject.mockReturnValue(undefined);
    mockUseDriveInitialization.mockReturnValue({ storageRootUri: undefined });
    mockResolveCatalogUri.mockReturnValue(undefined);
  });

  it('passes children through when the user is logged out', () => {
    mockUseSolidAuth.mockReturnValue({ session: { isLoggedIn: false, webId: undefined } });
    render(
      <RequestNotificationsGate>
        <div data-testid="child" />
      </RequestNotificationsGate>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(mockProvider).not.toHaveBeenCalled();
  });

  it('mounts the provider once the user has a known WebID', () => {
    mockUseSolidAuth.mockReturnValue({
      session: { isLoggedIn: true, webId: 'https://alice.example/profile/card#me' },
    });
    mockUseDriveInitialization.mockReturnValue({ storageRootUri: 'https://alice.example/' });
    mockResolveCatalogUri.mockReturnValue('https://alice.example/catalog.ttl');
    render(
      <RequestNotificationsGate>
        <div data-testid="child" />
      </RequestNotificationsGate>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(mockProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerWebId: 'https://alice.example/profile/card#me',
        storageRoot: 'https://alice.example/',
        catalogUri: 'https://alice.example/catalog.ttl',
      }),
    );
  });

  it('mounts the provider with empty strings while storage and catalog are still loading', () => {
    mockUseSolidAuth.mockReturnValue({
      session: { isLoggedIn: true, webId: 'https://alice.example/profile/card#me' },
    });
    render(
      <RequestNotificationsGate>
        <div data-testid="child" />
      </RequestNotificationsGate>,
    );
    expect(mockProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        storageRoot: '',
        catalogUri: '',
      }),
    );
  });
});
