import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App-file/App';

// Mock all child components and providers
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(() => ({ session: { isLoggedIn: false } })),
  BrowserSolidLdoProvider: ({ children }: any) => <div data-testid="solid-provider">{children}</div>,
}));

vi.mock('@/features/auth/components/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/features/file-explorer/components/FileExplorer', () => ({
  FileExplorer: () => <div data-testid="file-explorer">FileExplorer</div>,
}));

vi.mock('@/features/profile/components/ProfileSidebar', () => ({
  ProfileSidebar: () => <div data-testid="profile-sidebar">ProfileSidebar</div>,
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: any) => <div data-testid="notification-provider">{children}</div>,
}));

vi.mock('../App-file/App.css', () => ({}));

import { useSolidAuth } from '@ldo/solid-react';

describe('App', () => {
  it('is defined', () => {
    expect(App).toBeDefined();
  });

  it('renders the app wrapper div', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.App')).toBeInTheDocument();
  });

  it('renders BrowserSolidLdoProvider', () => {
    render(<App />);
    expect(screen.getByTestId('solid-provider')).toBeInTheDocument();
  });

  it('renders NotificationProvider', () => {
    render(<App />);
    expect(screen.getByTestId('notification-provider')).toBeInTheDocument();
  });

  it('renders Header', () => {
    render(<App />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders FileExplorer when logged out', () => {
    render(<App />);
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
  });

  it('does not render ProfileSidebar when logged out', () => {
    render(<App />);
    expect(screen.queryByTestId('profile-sidebar')).not.toBeInTheDocument();
  });

  it('renders ProfileSidebar and FileExplorer when logged in', () => {
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as any);
    render(<App />);
    expect(screen.getByTestId('profile-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
  });

  it('renders app-layout class when logged in', () => {
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as any);
    const { container } = render(<App />);
    expect(container.querySelector('.app-layout')).toBeInTheDocument();
    expect(container.querySelector('.app-main')).toBeInTheDocument();
  });

  it('does not render app-layout class when logged out', () => {
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as any);
    const { container } = render(<App />);
    expect(container.querySelector('.app-layout')).not.toBeInTheDocument();
  });
});
