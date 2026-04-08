import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSwitcher } from '../LanguageSwitcher-file/LanguageSwitcher';
import { SUPPORTED_LANGUAGES } from '@/config';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(),
}));

import { useTranslation } from 'react-i18next';

beforeEach(() => {
  vi.clearAllMocks();
  (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue([
    (key: string) => key,
    { resolvedLanguage: SUPPORTED_LANGUAGES[0].code, changeLanguage: mockChangeLanguage },
  ]);
});

describe('LanguageSwitcher', () => {
  it('renders a dropdown with an accessible label', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('combobox', { name: 'languageSwitcher.label' })).toBeInTheDocument();
  });

  it('renders an option for each supported language', () => {
    render(<LanguageSwitcher />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(SUPPORTED_LANGUAGES.length);
  });

  it('renders each language label as an option', () => {
    render(<LanguageSwitcher />);
    for (const language of SUPPORTED_LANGUAGES) {
      expect(screen.getByRole('option', { name: language.label })).toBeInTheDocument();
    }
  });

  it('selects the current resolved language by default', () => {
    render(<LanguageSwitcher />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe(SUPPORTED_LANGUAGES[0].code);
  });

  it('calls i18n.changeLanguage with the selected language code on change', () => {
    render(<LanguageSwitcher />);
    const secondLang = SUPPORTED_LANGUAGES[1] ?? SUPPORTED_LANGUAGES[0];
    fireEvent.change(screen.getByRole('combobox'), { target: { value: secondLang.code } });
    expect(mockChangeLanguage).toHaveBeenCalledWith(secondLang.code);
  });

  it('calls changeLanguage exactly once per change event', () => {
    render(<LanguageSwitcher />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: SUPPORTED_LANGUAGES[0].code },
    });
    expect(mockChangeLanguage).toHaveBeenCalledTimes(1);
  });
});
