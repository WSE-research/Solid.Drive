import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from '../TopBar-file/TopBar';

const mockLogout = vi.fn();
const mockChangeLanguage = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(() => ({
    session: { isLoggedIn: true, webId: 'https://alice.example/profile/card#me' },
    logout: mockLogout,
  })),
  useResource: vi.fn(() => null),
  useSubject: vi.fn(() => ({ fn: 'Alice Doe' })),
}));

import { useSolidAuth, useSubject } from '@ldo/solid-react';

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
    {
      resolvedLanguage: 'en',
      changeLanguage: mockChangeLanguage,
    },
  ],
}));

vi.mock('@/config', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ],
}));

beforeEach(() => {
  mockLogout.mockClear();
  mockChangeLanguage.mockClear();
  localStorage.clear();
  // Reset mock return values to the happy path defaults — individual tests
  // override these to drive the auth-restore and photo-loaded branches.
  vi.mocked(useSolidAuth).mockReturnValue({
    session: { isLoggedIn: true, webId: 'https://alice.example/profile/card#me' },
    logout: mockLogout,
  } as ReturnType<typeof useSolidAuth>);
  vi.mocked(useSubject).mockReturnValue({ fn: 'Alice Doe' } as ReturnType<typeof useSubject>);
});

describe('TopBar — brand', () => {
  it('renders the Solid.drive logo image on the left', () => {
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    expect(screen.getByRole('img', { name: /solid\.drive/i })).toBeInTheDocument();
  });
});

describe('TopBar — search', () => {
  it('renders the search input and forwards changes', () => {
    const onSearch = vi.fn();
    render(<TopBar searchValue="" onSearchChange={onSearch} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'foo' } });
    expect(onSearch).toHaveBeenCalledWith('foo');
  });

  it('reflects the controlled search value', () => {
    render(<TopBar searchValue="hello" onSearchChange={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveValue('hello');
  });
});

describe('TopBar — settings dropdown', () => {
  it('renders the settings (gear) trigger', () => {
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('clicking the gear opens a menu with the Language label and language radios', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByText(/language/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /deutsch/i })).toBeInTheDocument();
  });

  it('marks the resolved language as checked', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    const english = await screen.findByRole('menuitemradio', { name: /english/i });
    expect(english).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking a language radio calls i18n.changeLanguage', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(await screen.findByRole('menuitemradio', { name: /deutsch/i }));
    expect(mockChangeLanguage).toHaveBeenCalledWith('de');
  });

  it('settings menu exposes the layout toggle which flips the layout preference', async () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    // The toggle is a Radix ToggleGroup; pills render with role="radio".
    const classicPill = await screen.findByRole('radio', { name: /classic/i });
    await user.click(classicPill);
    expect(localStorage.getItem('solid-drive.layout')).toBe('classic');
  });
});

describe('TopBar — avatar dropdown', () => {
  it('renders the avatar (Account) trigger', () => {
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
  });

  it('clicking the avatar shows the display name and the WebID', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    expect(await screen.findByText('Alice Doe')).toBeInTheDocument();
    expect(screen.getByText('https://alice.example/profile/card#me')).toBeInTheDocument();
  });

  it('exposes a "View profile" link pointing at the WebID', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    const link = await screen.findByRole('menuitem', { name: /view profile/i });
    expect(link).toHaveAttribute('href', 'https://alice.example/profile/card#me');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('exposes a Log out item that calls Solid auth logout', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    await user.click(await screen.findByRole('menuitem', { name: /log out/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does not include language items in the avatar dropdown anymore', async () => {
    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    await screen.findByRole('menuitem', { name: /log out/i });
    expect(screen.queryByRole('menuitemradio', { name: /english/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /classic/i })).not.toBeInTheDocument();
  });
});

describe('TopBar — profile resolution branches', () => {
  it('falls back to "Signed in" placeholder during the auth-restore window (no webId, no profile)', async () => {
    // Simulate the brief window after a refresh: useSolidAuth has no webId
    // yet, useSubject returns null because the document hasn't been fetched.
    vi.mocked(useSolidAuth).mockReturnValue({
      session: { isLoggedIn: false, webId: undefined },
      logout: mockLogout,
    } as ReturnType<typeof useSolidAuth>);
    vi.mocked(useSubject).mockReturnValue(null as unknown as ReturnType<typeof useSubject>);

    const user = userEvent.setup();
    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    // displayName falls back to the localized "Signed in" label, the avatar
    // alt falls back to the "Account" label, and the WebID line + View
    // profile link drop out because webId is empty.
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /view profile/i })).not.toBeInTheDocument();
  });

  it('renders the profile photo as the avatar src when profile.img is set', () => {
    vi.mocked(useSubject).mockReturnValue({
      name: 'Bob Builder',
      img: { '@id': 'https://bob.example/avatar.jpg' },
    } as ReturnType<typeof useSubject>);

    render(<TopBar searchValue="" onSearchChange={() => {}} />);
    // The trigger avatar renders an <img> when src is provided (instead of
    // the placeholder initial circle).
    const avatarImg = screen.getByAltText(/bob builder/i);
    expect(avatarImg.tagName).toBe('IMG');
    expect(avatarImg).toHaveAttribute('src', 'https://bob.example/avatar.jpg');
  });
});
