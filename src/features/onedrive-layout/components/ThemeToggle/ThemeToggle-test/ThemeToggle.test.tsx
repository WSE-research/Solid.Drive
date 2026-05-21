import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle-file/ThemeToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders a labeled trigger that exposes the current theme', () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole('combobox', { name: /theme/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/dark/i);
  });

  it('reflects the persisted preference on the trigger', () => {
    localStorage.setItem('solid-drive.theme', 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(
      /light/i,
    );
  });

  it(
    'opens the listbox with both options when clicked',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<ThemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /theme/i }));
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /light/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /dark/i })).toBeInTheDocument();
    },
    15000,
  );

  it(
    'selecting Light persists the value and mirrors it onto documentElement',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<ThemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /theme/i }));
      await user.click(await screen.findByRole('option', { name: /light/i }));
      expect(localStorage.getItem('solid-drive.theme')).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(
        /light/i,
      );
    },
    15000,
  );

  it(
    'selecting Dark from a persisted Light state switches back',
    async () => {
      localStorage.setItem('solid-drive.theme', 'light');
      const user = userEvent.setup({ delay: null });
      render(<ThemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /theme/i }));
      await user.click(await screen.findByRole('option', { name: /dark/i }));
      expect(localStorage.getItem('solid-drive.theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    },
    15000,
  );
});
