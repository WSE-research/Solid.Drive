import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutToggle } from '../LayoutToggle-file/LayoutToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

describe('LayoutToggle', () => {
  beforeEach(() => localStorage.clear());

  it('renders both pills inside a labeled group', () => {
    render(<LayoutToggle />);
    expect(screen.getByRole('group', { name: /layout/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /classic/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /onedrive/i })).toBeInTheDocument();
  });

  it('marks "Classic" pressed by default', () => {
    render(<LayoutToggle />);
    expect(screen.getByRole('radio', { name: /classic/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /onedrive/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects the persisted preference on mount', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    render(<LayoutToggle />);
    expect(screen.getByRole('radio', { name: /onedrive/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking "OneDrive" flips the active pill and persists the value', () => {
    render(<LayoutToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /onedrive/i }));
    expect(screen.getByRole('radio', { name: /onedrive/i })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('solid-drive.layout')).toBe('onedrive');
  });

  it('clicking the active pill again does not unset the preference', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    render(<LayoutToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /onedrive/i }));
    expect(screen.getByRole('radio', { name: /onedrive/i })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('solid-drive.layout')).toBe('onedrive');
  });
});
