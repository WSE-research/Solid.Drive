import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { ThemeToggle } from '../ThemeToggle-file/ThemeToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

let capturedOnValueChange: ((value: string) => void) | undefined;

vi.mock('@radix-ui/react-select', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@radix-ui/react-select')>();
  return {
    ...actual,
    Root: (props: ComponentProps<typeof actual.Root>) => {
      capturedOnValueChange = props.onValueChange;
      return <actual.Root {...props} />;
    },
  };
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // ThemeToggle only ever mounts inside the OneDrive shell's Settings
    // menu, so the layout preference is always 'onedrive' by the time it
    // renders; the merged experience otherwise collapses to 'classic'
    // regardless of the stored theme.
    localStorage.setItem('solid-drive.layout', 'onedrive');
  });

  it('renders a labeled trigger that exposes the current theme', () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole('combobox', { name: /theme/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/dark/i);
  });

  it('reflects the persisted theme preference on the trigger', () => {
    localStorage.setItem('solid-drive.theme', 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(
      /light/i,
    );
  });

  it('shows Classic on the trigger when the classic layout is persisted', () => {
    localStorage.setItem('solid-drive.layout', 'classic');
    render(<ThemeToggle />);
    expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(
      /classic/i,
    );
  });

  it(
    'opens the listbox with Classic plus every shipped theme when clicked',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<ThemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /theme/i }));
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /classic/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /light/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /dark/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /dropbox/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /google drive/i })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(5);
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

  it(
    'selecting Dropbox persists the value and mirrors it onto documentElement',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<ThemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /theme/i }));
      await user.click(await screen.findByRole('option', { name: /dropbox/i }));
      expect(localStorage.getItem('solid-drive.theme')).toBe('dropbox');
      // DropboxTheme.css is keyed entirely off this attribute value.
      expect(document.documentElement.getAttribute('data-theme')).toBe('dropbox');
      expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(
        /dropbox/i,
      );
    },
    15000,
  );

  it('reflects a persisted Dropbox preference on the trigger', () => {
    localStorage.setItem('solid-drive.theme', 'dropbox');
    render(<ThemeToggle />);
    expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(
      /dropbox/i,
    );
  });

  it(
    'selecting Classic persists the layout preference and leaves the theme untouched',
    async () => {
      localStorage.setItem('solid-drive.theme', 'gdrive');
      const user = userEvent.setup({ delay: null });
      render(<ThemeToggle />);
      await user.click(screen.getByRole('combobox', { name: /theme/i }));
      await user.click(await screen.findByRole('option', { name: /classic/i }));
      expect(localStorage.getItem('solid-drive.layout')).toBe('classic');
      expect(localStorage.getItem('solid-drive.theme')).toBe('gdrive');
    },
    15000,
  );

  it('ignores a value from onValueChange that is not a known experience', () => {
    render(<ThemeToggle />);
    capturedOnValueChange?.('not-a-real-experience');
    expect(localStorage.getItem('solid-drive.theme')).toBeNull();
    expect(screen.getByRole('combobox', { name: /theme/i })).toHaveTextContent(/dark/i);
  });
});
