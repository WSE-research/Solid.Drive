import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import App from '../App-file/App';

// App mounts BrowserRouter with basename="/solid-hello-world-frontend-react";
// jsdom's default URL is "/", so without aligning the path the router would
// refuse to render any of its children and every assertion below would fail.
const ROUTER_BASENAME_PATH = '/solid-hello-world-frontend-react/';

// Mock all child components and providers
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(() => ({ session: { isLoggedIn: false } })),
  BrowserSolidLdoProvider: ({ children }: { children: ReactNode }) => <div data-testid="solid-provider">{children}</div>,
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

vi.mock('@/features/onedrive-layout/components/OneDriveLayout', () => ({
  OneDriveLayout: () => <div data-testid="onedrive-layout">OneDriveLayout</div>,
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: ReactNode }) => <div data-testid="notification-provider">{children}</div>,
}));

vi.mock('../App-file/App.css', () => ({}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
vi.mock('../App-file/github-fork-ribbon.css', () => ({}));

import { useSolidAuth } from '@ldo/solid-react';

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', ROUTER_BASENAME_PATH);
  });

  it('renders the app-root element', () => {
    const { container } = render(<App />);
    expect(container.querySelector('app-root')).toBeInTheDocument();
  });

  it('renders BrowserSolidLdoProvider', () => {
    render(<App />);
    expect(screen.getByTestId('solid-provider')).toBeInTheDocument();
  });

  it('renders NotificationProvider', () => {
    render(<App />);
    expect(screen.getByTestId('notification-provider')).toBeInTheDocument();
  });

  it('renders Header component inside the app layout', () => {
    render(<App />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('hides the Header when OneDrive layout is active and logged in', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
    expect(screen.getByTestId('onedrive-layout')).toBeInTheDocument();
  });

  it('keeps the Header when OneDrive layout is selected but the user is logged out', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  it('renders OneDriveLayout during the auth-restore window when the session was active before refresh', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    sessionStorage.setItem('solid-drive.session-active', '1');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('onedrive-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
  });

  it('falls back to the Header when OneDrive is selected, no session flag is present, and the user is logged out (first-visit case)', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    // sessionStorage intentionally empty — never had an active session this tab.
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  it('renders FileExplorer when logged out', () => {
    render(<App />);
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
  });

  it('does not render ProfileSidebar when logged out', () => {
    render(<App />);
    expect(screen.queryByTestId('profile-sidebar')).not.toBeInTheDocument();
  });

  it('renders ClassicLayout when logged in and preference is "classic"', () => {
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('profile-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  it('renders OneDriveLayout when logged in and preference is "onedrive"', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('onedrive-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-sidebar')).not.toBeInTheDocument();
  });

  it('renders FileExplorer (not the OneDrive shell) when logged out, regardless of preference', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  it('renders app-layout element when logged in with classic preference', () => {
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    const { container } = render(<App />);
    expect(container.querySelector('app-layout')).toBeInTheDocument();
    expect(container.querySelector('.app-main')).toBeInTheDocument();
  });

  it('does not render app-layout element when logged out', () => {
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    const { container } = render(<App />);
    expect(container.querySelector('app-layout')).not.toBeInTheDocument();
  });
});

describe('App — useSessionContinuity edge cases', () => {
  describe('when sessionStorage access throws (e.g. browser privacy mode)', () => {
    let getItemSpy: ReturnType<typeof vi.spyOn<Storage, 'getItem'>>;

    beforeEach(() => {
      getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        if (key === 'solid-drive.session-active') {
          throw new Error('SecurityError: storage disabled');
        }
        // Defer to localStorage's real backing for non-flag keys (layout pref).
        return null;
      });
    });

    afterEach(() => {
      getItemSpy.mockRestore();
    });

    it('falls back to false (no session continuity) without crashing', () => {
      // Layout pref is onedrive, would-be session flag is unreadable, user
      // is logged out → AppShell must render the Header path (not OneDrive)
      // because we can't tell that a session was active.
      localStorage.setItem('solid-drive.layout', 'onedrive');
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
      render(<App />);
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
    });
  });

  it('clears the session flag when the user transitions from logged in to logged out', () => {
    // First render with isLoggedIn=true so the effect sets the flag.
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    const { rerender } = render(<App />);
    expect(sessionStorage.getItem('solid-drive.session-active')).toBe('1');

    // Now flip to logged out — the effect should clear the flag (covering the
    // post-login logout branch) and AppShell should fall back to the Header.
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    rerender(<App />);
    expect(sessionStorage.getItem('solid-drive.session-active')).toBeNull();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  describe('when sessionStorage write methods throw', () => {
    let setItemSpy: ReturnType<typeof vi.spyOn<Storage, 'setItem'>>;
    let removeItemSpy: ReturnType<typeof vi.spyOn<Storage, 'removeItem'>>;

    beforeEach(() => {
      setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError: storage disabled');
      });
      removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError: storage disabled');
      });
    });

    afterEach(() => {
      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
    });

    it('does not crash when sessionStorage.setItem and removeItem throw', () => {
      // Logged in → setItem path throws inside the catch block.
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
      const { rerender } = render(<App />);
      expect(screen.getByTestId('header')).toBeInTheDocument();

      // Logout transition → removeItem path throws inside the catch block.
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
      rerender(<App />);
      expect(screen.getByTestId('header')).toBeInTheDocument();
    });
  });
});
