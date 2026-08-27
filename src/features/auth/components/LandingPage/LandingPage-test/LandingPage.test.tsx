import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(),
}));

let observedWidth = 0;
vi.mock('@/features/auth/hooks/useResizeObserver', () => ({
  useResizeObserver: () => ({ width: observedWidth, height: 0 }),
}));

const renderWithRouter = (ui: ReactElement, initialPath: string = '/') =>
  render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/features/auth/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

const layoutSetter = vi.fn();
let currentLayout: 'classic' | 'onedrive' = 'classic';
const themeSetter = vi.fn();
let currentTheme: 'dark' | 'light' | 'dropbox' | 'gdrive' = 'dark';

// The two preferences are mocked at their own module paths, so the real
// useExperiencePreference below runs its translation rule against them: the
// picker assertions still pin what a card click writes to each axis.
vi.mock('@/features/onedrive-layout/hooks/useLayoutPreference', () => ({
  useLayoutPreference: () => [currentLayout, layoutSetter],
  isLayout: (value: unknown) => value === 'classic' || value === 'onedrive',
}));

vi.mock('@/features/onedrive-layout/hooks/useThemePreference', () => ({
  useThemePreference: () => [currentTheme, themeSetter],
  THEMES: ['light', 'dark', 'dropbox', 'gdrive'],
  isTheme: (value: unknown) =>
    ['light', 'dark', 'dropbox', 'gdrive'].includes(value as string),
}));

vi.mock('@/features/onedrive-layout', async () => {
  const experience = await import(
    '@/features/onedrive-layout/hooks/useExperiencePreference'
  );
  return {
    ...experience,
    useLayoutPreference: () => [currentLayout, layoutSetter],
    isLayout: (value: unknown) => value === 'classic' || value === 'onedrive',
    useThemePreference: () => [currentTheme, themeSetter],
    THEMES: ['light', 'dark', 'dropbox', 'gdrive'],
    InstallAppButton: () => null,
  };
});

import { useSolidAuth } from '@ldo/solid-react';
import { CUSTOM_PROVIDER_VALUE, SOLID_PROVIDERS } from '@/config';
import { LandingPage } from '../LandingPage-file/LandingPage';

// The login button now reports failures through the notification toast, so the
// components under test consume NotificationContext. Mocked rather than wrapped
// in a real provider: these tests assert on login wiring, not on toasts.
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showError: vi.fn(),
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    confirm: vi.fn(),
  }),
}));


const loginMock = vi.fn();

const realProviders = SOLID_PROVIDERS.filter(
  (provider) => provider.value !== CUSTOM_PROVIDER_VALUE,
);
const [recommendedProvider, secondProvider] = realProviders;

const openProviderListbox = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'landing.providers.expand' }));
};

const getProviderOption = (label: string): HTMLElement =>
  screen.getByRole('option', { name: new RegExp(label, 'i') });

beforeEach(() => {
  vi.clearAllMocks();
  currentLayout = 'classic';
  currentTheme = 'dark';
  observedWidth = 0;
  (useSolidAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    session: { isActive: false, webId: undefined },
    login: loginMock,
    logout: vi.fn(),
  });
});

describe('LandingPage — structure', () => {
  it('renders the page heading with the app name', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/solid\.drive/i);
  });

  it('renders the four onboarding steps on the /no-pod route', () => {
    renderWithRouter(<LandingPage />, '/no-pod');
    expect(screen.getByText('landing.onboarding.step1')).toBeInTheDocument();
    expect(screen.getByText('landing.onboarding.step2')).toBeInTheDocument();
    expect(screen.getByText('landing.onboarding.step3')).toBeInTheDocument();
    expect(screen.getByText('landing.onboarding.step4')).toBeInTheDocument();
  });

  it('renders a provider listbox option for every non-custom provider', () => {
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    const listbox = screen.getByRole('listbox', {
      name: 'landing.providers.heading',
    });
    expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(realProviders.length);
  });

  it('renders the classic choice plus one card per available theme', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('landing.layoutPicker.classic.label')).toBeInTheDocument();
    expect(screen.getByText('landing.layoutPicker.onedriveLight.label')).toBeInTheDocument();
    expect(screen.getByText('landing.layoutPicker.onedriveDark.label')).toBeInTheDocument();
    expect(screen.getByText('landing.layoutPicker.dropbox.label')).toBeInTheDocument();
    expect(screen.getByText('landing.layoutPicker.gdrive.label')).toBeInTheDocument();
  });
});

describe('LandingPage — provider selection', () => {
  it('preselects the first provider in the trigger', () => {
    renderWithRouter(<LandingPage />);
    const trigger = screen.getByRole('button', { name: 'landing.providers.expand' });
    expect(trigger).toHaveTextContent(recommendedProvider.label);
    openProviderListbox();
    expect(getProviderOption(recommendedProvider.label)).toHaveAttribute('aria-selected', 'true');
  });

  it('switches the active provider when another option is clicked', () => {
    if (!secondProvider) return;
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    fireEvent.click(getProviderOption(secondProvider.label));
    const trigger = screen.getByRole('button', { name: 'landing.providers.expand' });
    expect(trigger).toHaveTextContent(secondProvider.label);
  });
});

describe('LandingPage — custom issuer', () => {
  it('clears the preselected provider when a custom issuer is typed', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.change(screen.getByPlaceholderText('landing.customIssuer.placeholder'), {
      target: { value: 'https://typed.example' },
    });
    openProviderListbox();
    expect(getProviderOption(recommendedProvider.label)).toHaveAttribute('aria-selected', 'false');
  });

  it('shows an inline error for an invalid custom URL', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.change(screen.getByPlaceholderText('landing.customIssuer.placeholder'), {
      target: { value: 'not a url' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('landing.customIssuer.invalid');
  });

  it('disables the login button while the custom URL is invalid', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.change(screen.getByPlaceholderText('landing.customIssuer.placeholder'), {
      target: { value: 'not a url' },
    });
    expect(screen.getByRole('button', { name: 'landing.actions.loginAria' })).toBeDisabled();
  });
});

describe('LandingPage — login action', () => {
  it('calls login with the selected provider value', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'landing.actions.loginAria' }));
    expect(loginMock).toHaveBeenCalledWith(recommendedProvider.value, window.location.href);
  });

  it('calls login with a valid custom URL', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.change(screen.getByPlaceholderText('landing.customIssuer.placeholder'), {
      target: { value: 'https://typed.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'landing.actions.loginAria' }));
    expect(loginMock).toHaveBeenCalledWith('https://typed.example', window.location.href);
  });

  it('does not call login when nothing is selected and no valid URL is typed', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.change(screen.getByPlaceholderText('landing.customIssuer.placeholder'), {
      target: { value: 'not a url' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'landing.actions.loginAria' }));
    expect(loginMock).not.toHaveBeenCalled();
  });
});

describe('LandingPage — experience picker', () => {
  const getCard = (
    key: 'classic' | 'onedriveLight' | 'onedriveDark' | 'dropbox',
  ): HTMLElement =>
    screen.getByRole('radio', {
      name: new RegExp(`landing\\.layoutPicker\\.${key}\\.label`, 'i'),
    });

  it('marks the classic card as checked on the classic layout', () => {
    renderWithRouter(<LandingPage />);
    expect(getCard('classic')).toHaveAttribute('aria-checked', 'true');
  });

  it('marks the card of the active theme as checked on the OneDrive layout', () => {
    currentLayout = 'onedrive';
    currentTheme = 'dropbox';
    renderWithRouter(<LandingPage />);
    expect(getCard('dropbox')).toHaveAttribute('aria-checked', 'true');
    expect(getCard('onedriveLight')).toHaveAttribute('aria-checked', 'false');
    expect(getCard('onedriveDark')).toHaveAttribute('aria-checked', 'false');
    expect(getCard('classic')).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the light card as checked when the OneDrive layout wears the light theme', () => {
    currentLayout = 'onedrive';
    currentTheme = 'light';
    renderWithRouter(<LandingPage />);
    expect(getCard('onedriveLight')).toHaveAttribute('aria-checked', 'true');
    expect(getCard('dropbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('selecting a theme card sets the OneDrive layout and that theme', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(getCard('dropbox'));
    expect(layoutSetter).toHaveBeenCalledWith('onedrive');
    expect(themeSetter).toHaveBeenCalledWith('dropbox');

    fireEvent.click(getCard('onedriveLight'));
    expect(themeSetter).toHaveBeenCalledWith('light');
  });

  it('selecting the card of the already-active theme only moves the layout axis', () => {
    currentTheme = 'dark';
    renderWithRouter(<LandingPage />);
    fireEvent.click(getCard('onedriveDark'));
    expect(layoutSetter).toHaveBeenCalledWith('onedrive');
    expect(themeSetter).not.toHaveBeenCalled();
  });

  it('selecting Classic never touches the theme axis', () => {
    currentLayout = 'onedrive';
    currentTheme = 'dropbox';
    renderWithRouter(<LandingPage />);
    fireEvent.click(getCard('classic'));
    expect(layoutSetter).toHaveBeenCalledWith('classic');
    expect(themeSetter).not.toHaveBeenCalled();
  });
});

describe('LandingPage — pod registration link', () => {
  it('uses the active provider registerUrl when available', () => {
    const providerWithRegister = realProviders.find((provider) => provider.registerUrl);
    if (!providerWithRegister) return;
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    fireEvent.click(getProviderOption(providerWithRegister.label));
    expect(screen.getByText('landing.actions.createPod')).toHaveAttribute(
      'href',
      providerWithRegister.registerUrl,
    );
  });
});

describe('LandingPage — video sub-route', () => {
  it('renders the video walkthrough page on /video', () => {
    renderWithRouter(<LandingPage />, '/video');
    expect(screen.getByText('landing.pages.video.title')).toBeInTheDocument();
    expect(screen.getByText('landing.pages.video.lead')).toBeInTheDocument();
    expect(screen.getByText('landing.onboarding.videoCaption')).toBeInTheDocument();
    expect(screen.getByLabelText('landing.onboarding.videoAria')).toBeInTheDocument();
  });
});

describe('LandingPage — provider listbox close behaviour', () => {
  const PROVIDERS_LISTBOX_ID = 'landing-providers-heading-listbox';

  const isListboxOpen = (): boolean => {
    const listbox = document.getElementById(PROVIDERS_LISTBOX_ID);
    return listbox?.getAttribute('data-state') === 'open';
  };

  const getProviderTrigger = (): HTMLElement =>
    screen.getByRole('button', {
      name: /landing\.providers\.(expand|collapse)/,
    });

  it('closes the listbox when the Escape key is pressed', () => {
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    expect(isListboxOpen()).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isListboxOpen()).toBe(false);
  });

  it('leaves the listbox open when a non-Escape key is pressed', () => {
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    fireEvent.keyDown(document, { key: 'a' });
    expect(isListboxOpen()).toBe(true);
  });

  it('closes the listbox when a pointerdown lands outside the combobox', () => {
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    expect(isListboxOpen()).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(isListboxOpen()).toBe(false);
  });

  it('keeps the listbox open when a pointerdown lands inside the combobox', () => {
    renderWithRouter(<LandingPage />);
    openProviderListbox();
    fireEvent.pointerDown(getProviderTrigger());
    expect(isListboxOpen()).toBe(true);
  });
});

describe('LandingPage — responsive data attributes', () => {
  const landingMain = (): HTMLElement => {
    const main = document.querySelector('main.landing');
    if (!main) throw new Error('landing <main> not rendered');
    return main as HTMLElement;
  };

  it('marks the shell as narrow when the observed width crosses the narrow breakpoint', () => {
    observedWidth = 800;
    renderWithRouter(<LandingPage />);
    expect(landingMain()).toHaveAttribute('data-narrow');
    expect(landingMain()).not.toHaveAttribute('data-compact');
    expect(landingMain()).not.toHaveAttribute('data-phone');
  });

  it('marks the shell as compact when the observed width crosses the compact breakpoint', () => {
    observedWidth = 560;
    renderWithRouter(<LandingPage />);
    expect(landingMain()).toHaveAttribute('data-narrow');
    expect(landingMain()).toHaveAttribute('data-compact');
    expect(landingMain()).not.toHaveAttribute('data-phone');
  });

  it('marks the shell as phone-sized when the observed width crosses the phone breakpoint', () => {
    observedWidth = 360;
    renderWithRouter(<LandingPage />);
    expect(landingMain()).toHaveAttribute('data-narrow');
    expect(landingMain()).toHaveAttribute('data-compact');
    expect(landingMain()).toHaveAttribute('data-phone');
  });
});
