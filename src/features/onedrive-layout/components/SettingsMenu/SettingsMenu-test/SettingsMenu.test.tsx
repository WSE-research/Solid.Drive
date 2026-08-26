import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsMenu } from '../SettingsMenu-file/SettingsMenu';

const mockChangeLanguage = vi.fn();

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

describe('SettingsMenu', () => {
  beforeEach(() => {
    mockChangeLanguage.mockClear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders a Settings trigger button', () => {
    render(<SettingsMenu />);
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it(
    'opening the menu exposes Language radios and the Theme select, with Classic among its options',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<SettingsMenu />);
      await user.click(screen.getByRole('button', { name: /settings/i }));

      expect(await screen.findByRole('menuitemradio', { name: /english/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /deutsch/i })).toBeInTheDocument();

      const themeSelect = screen.getByRole('combobox', { name: /theme/i });
      expect(themeSelect).toBeInTheDocument();
      await user.click(themeSelect);
      expect(await screen.findByRole('option', { name: /classic/i })).toBeInTheDocument();
    },
    15000,
  );

  it(
    'selecting a language calls i18n.changeLanguage',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<SettingsMenu />);
      await user.click(screen.getByRole('button', { name: /settings/i }));
      await user.click(await screen.findByRole('menuitemradio', { name: /deutsch/i }));
      expect(mockChangeLanguage).toHaveBeenCalledWith('de');
    },
    15000,
  );
});
