import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorSchemeToggle } from '../ColorSchemeToggle-file/ColorSchemeToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

describe('ColorSchemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-scheme');
  });

  it('renders a labeled trigger showing the default Indigo scheme', () => {
    render(<ColorSchemeToggle />);
    const trigger = screen.getByRole('combobox', { name: /color/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/indigo/i);
  });

  it('reflects the persisted preference on the trigger', () => {
    localStorage.setItem('solid-drive.color-scheme', 'emerald');
    render(<ColorSchemeToggle />);
    expect(screen.getByRole('combobox', { name: /color/i })).toHaveTextContent(/emerald/i);
  });

  it(
    'opens the listbox with all four schemes when clicked',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<ColorSchemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /color/i }));
      expect(await screen.findByRole('listbox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /indigo/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /emerald/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /amber/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /rose/i })).toBeInTheDocument();
    },
    15000,
  );

  it(
    'selecting Emerald persists the value and mirrors it onto documentElement',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<ColorSchemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /color/i }));
      await user.click(await screen.findByRole('option', { name: /emerald/i }));
      expect(localStorage.getItem('solid-drive.color-scheme')).toBe('emerald');
      expect(document.documentElement.getAttribute('data-scheme')).toBe('emerald');
      expect(screen.getByRole('combobox', { name: /color/i })).toHaveTextContent(/emerald/i);
    },
    15000,
  );
});
