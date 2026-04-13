import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileSidebar } from '../ProfileSidebar-file/ProfileSidebar';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({
    session: { webId: mockWebId },
  }),
  useSubject: () => mockProfile,
}));

let mockWebId: string | undefined = 'https://pod.example/profile/card#me';
let mockProfile: Record<string, unknown> | null = {
  storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
};

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => 'https://pod.example/solidweb/catalog.ttl',
}));

vi.mock('@/features/profile/components/ProfileCard', () => ({
  ProfileCard: () => <div data-testid="profile-card">ProfileCard</div>,
}));

vi.mock('@/features/profile/components/ContactsList', () => ({
  ContactsList: ({ ownerWebId }: { ownerWebId: string }) => (
    <div data-testid="contacts-list">{ownerWebId}</div>
  ),
}));

vi.mock('@/features/profile/components/RequestsPanel', () => ({
  RequestsPanel: ({ ownerWebId, storageRoot, catalogUri }: { ownerWebId: string; storageRoot: string; catalogUri: string }) => (
    <div data-testid="requests-panel">
      {ownerWebId}|{storageRoot}|{catalogUri}
    </div>
  ),
}));

describe('ProfileSidebar', () => {
  beforeEach(() => {
    mockWebId = 'https://pod.example/profile/card#me';
    mockProfile = {
      storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
    };
  });

  it('renders aside with correct class', () => {
    render(<ProfileSidebar />);
    const aside = document.querySelector('aside.profile-sidebar');
    expect(aside).toBeInTheDocument();
  });

  it('renders ProfileCard component in the sidebar', () => {
    render(<ProfileSidebar />);
    expect(screen.getByTestId('profile-card')).toBeInTheDocument();
  });

  it('renders ContactsList with ownerWebId', () => {
    render(<ProfileSidebar />);
    const contactsList = screen.getByTestId('contacts-list');
    expect(contactsList).toHaveTextContent('https://pod.example/profile/card#me');
  });

  it('renders RequestsPanel with correct props when all values are present', () => {
    render(<ProfileSidebar />);
    const panel = screen.getByTestId('requests-panel');
    expect(panel).toHaveTextContent(
      'https://pod.example/profile/card#me|https://pod.example/|https://pod.example/solidweb/catalog.ttl'
    );
  });

  it('renders dividers between sections', () => {
    render(<ProfileSidebar />);
    const dividers = document.querySelectorAll('.profile-sidebar__divider');
    expect(dividers.length).toBe(2);
  });

  it('renders the profile-sidebar-card wrapper around ProfileCard', () => {
    render(<ProfileSidebar />);
    expect(document.querySelector('profile-sidebar-card')).toBeInTheDocument();
  });

  it('falls back to webId-derived storageRoot when profile has no storage', () => {
    mockProfile = {
      storage: { toArray: () => [] },
    };
    render(<ProfileSidebar />);
    // storageRoot falls back to webId.replace(/\/profile\/card.*/, "/") = "https://pod.example/"
    const panel = screen.getByTestId('requests-panel');
    expect(panel).toHaveTextContent('https://pod.example/');
  });

  it('falls back to webId-derived storageRoot when storage is null', () => {
    mockProfile = { storage: null };
    render(<ProfileSidebar />);
    const panel = screen.getByTestId('requests-panel');
    expect(panel).toHaveTextContent('https://pod.example/');
  });

  it('hides RequestsPanel when ownerWebId is empty', () => {
    mockWebId = '';
    render(<ProfileSidebar />);
    expect(screen.queryByTestId('requests-panel')).not.toBeInTheDocument();
  });

  it('uses empty string when session.webId is undefined', () => {
    mockWebId = undefined;
    render(<ProfileSidebar />);
    // ownerWebId is "" → RequestsPanel hidden, ContactsList gets ""
    expect(screen.queryByTestId('requests-panel')).not.toBeInTheDocument();
  });
});
