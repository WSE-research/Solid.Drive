import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileSidebar } from '../ProfileSidebar-file/ProfileSidebar';

let mockWebId: string | undefined = 'https://pod.example/profile/card#me';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({
    session: { webId: mockWebId },
  }),
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
  RequestsPanel: () => <div data-testid="requests-panel">RequestsPanel</div>,
}));

describe('ProfileSidebar', () => {
  beforeEach(() => {
    mockWebId = 'https://pod.example/profile/card#me';
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

  it('renders RequestsPanel when ownerWebId is present', () => {
    render(<ProfileSidebar />);
    expect(screen.getByTestId('requests-panel')).toBeInTheDocument();
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

  it('hides RequestsPanel when ownerWebId is empty', () => {
    mockWebId = '';
    render(<ProfileSidebar />);
    expect(screen.queryByTestId('requests-panel')).not.toBeInTheDocument();
  });

  it('uses empty string when session.webId is undefined', () => {
    mockWebId = undefined;
    render(<ProfileSidebar />);
    expect(screen.queryByTestId('requests-panel')).not.toBeInTheDocument();
  });
});
