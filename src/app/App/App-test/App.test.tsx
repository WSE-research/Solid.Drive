import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import App from '../App-file/App';
import { ROUTER_BASENAME } from '@/config';

// jsdom starts at "/", so push the URL under BrowserRouter's basename
// before each render. Otherwise the router renders nothing.
const ROUTER_BASENAME_PATH = `${ROUTER_BASENAME}/`;

// Mock all child components and providers
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(() => ({ session: { isLoggedIn: false } })),
  BrowserSolidLdoProvider: ({ children }: { children: ReactNode }) => <div data-testid="solid-provider">{children}</div>,
}));

vi.mock('@/features/auth/components/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/features/auth/components/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page">LandingPage</div>,
}));

vi.mock('@/app/AuthCallbackSkeleton', () => ({
  AuthCallbackSkeleton: () => <div data-testid="auth-callback-skeleton">AuthCallbackSkeleton</div>,
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

vi.mock('@/app/RequestNotificationsGate', () => ({
  RequestNotificationsGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../App-file/App.css', () => ({}));

vi.mock('../App-file/github-fork-ribbon.css', () => ({}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

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

  it('renders the LandingPage when logged out', () => {
    render(<App />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('does not render the Header when logged out (Header is logged-in only)', () => {
    render(<App />);
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
  });

  it('hides the Header when OneDrive layout is active and logged in', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
    expect(screen.getByTestId('onedrive-layout')).toBeInTheDocument();
  });

  it('shows the LandingPage when OneDrive layout is selected but the user is logged out and no prior session', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
  });

  it('renders OneDriveLayout during the auth-restore window when the session was active before refresh', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    sessionStorage.setItem('solid-drive.session-active', '1');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('onedrive-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  it('renders the LandingPage on a first visit even when OneDrive is the saved preference', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  it('renders the AuthCallbackSkeleton (not the LandingPage) while OIDC callback params are present and auth has not resolved', () => {
    window.history.replaceState({}, '', `${ROUTER_BASENAME_PATH}?code=abc&state=xyz`);
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('auth-callback-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  it('keeps the AuthCallbackSkeleton during the boot window even after auth resolves', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    window.history.replaceState({}, '', `${ROUTER_BASENAME_PATH}?code=abc&state=xyz`);
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('auth-callback-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('onedrive-layout')).not.toBeInTheDocument();
  });

  it('falls back to the LandingPage when the URL has no OIDC callback params', () => {
    window.history.replaceState({}, '', `${ROUTER_BASENAME_PATH}?other=value`);
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-callback-skeleton')).not.toBeInTheDocument();
  });

  it('does not render the file explorer when logged out', () => {
    render(<App />);
    expect(screen.queryByTestId('file-explorer')).not.toBeInTheDocument();
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

  it('renders the LandingPage (not OneDrive) when logged out, regardless of saved layout preference', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    render(<App />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
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
      // is logged out → AppShell must render the LandingPage (not OneDrive)
      // because we can't tell that a session was active.
      localStorage.setItem('solid-drive.layout', 'onedrive');
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
      render(<App />);
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
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
    // post-login logout branch) and AppShell should fall back to the LandingPage.
    vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
    rerender(<App />);
    expect(sessionStorage.getItem('solid-drive.session-active')).toBeNull();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
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
      // Logged in → setItem path throws inside the catch block; the classic
      // shell still mounts (Header + ClassicLayout, default classic pref).
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: true } } as ReturnType<typeof useSolidAuth>);
      const { rerender } = render(<App />);
      expect(screen.getByTestId('header')).toBeInTheDocument();

      // Logout transition → removeItem path throws inside the catch block.
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
      rerender(<App />);
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });

  describe('when reading window.location.search throws', () => {
    let urlSearchParamsSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'URLSearchParams'>>;

    beforeEach(() => {
      urlSearchParamsSpy = vi
        .spyOn(globalThis, 'URLSearchParams')
        .mockImplementation(() => {
          throw new Error('SecurityError: location disabled');
        });
    });

    afterEach(() => {
      urlSearchParamsSpy.mockRestore();
    });

    it('treats the URL as having no callback params and renders the LandingPage', () => {
      // Even if the URL did carry code+state, an unreadable search string is
      // indistinguishable from a plain visit. The hook must fall back safely.
      window.history.replaceState({}, '', `${ROUTER_BASENAME_PATH}?code=abc&state=xyz`);
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
      render(<App />);
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      expect(screen.queryByTestId('auth-callback-skeleton')).not.toBeInTheDocument();
    });
  });

  describe('when the OIDC callback never resolves', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('lifts the skeleton after the max-hold window and falls back to the LandingPage', () => {
      window.history.replaceState({}, '', `${ROUTER_BASENAME_PATH}?code=abc&state=xyz`);
      vi.mocked(useSolidAuth).mockReturnValue({ session: { isLoggedIn: false } } as ReturnType<typeof useSolidAuth>);
      render(<App />);
      expect(screen.getByTestId('auth-callback-skeleton')).toBeInTheDocument();

      // After the max-hold window (10s) the hook gives up waiting for auth.
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(screen.queryByTestId('auth-callback-skeleton')).not.toBeInTheDocument();
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });
});
