import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperienceSwitcher } from '../ExperienceSwitcher-file/ExperienceSwitcher';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const LAYOUT_KEY = 'solid-drive.layout';
const THEME_KEY = 'solid-drive.theme';

const getSwitcher = (): HTMLSelectElement =>
  screen.getByRole('combobox', { name: /experience/i });

describe('ExperienceSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers the classic layout plus every shipped theme, in picker order', () => {
    render(<ExperienceSwitcher />);
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'Classic',
      'OneDrive (Light)',
      'OneDrive (Dark)',
      'Dropbox',
      'Google Drive',
    ]);
  });

  it('offers the Google Drive theme without a detour through the OneDrive settings menu', () => {
    render(<ExperienceSwitcher />);
    expect(screen.getByRole('option', { name: 'Google Drive' })).toBeInTheDocument();
  });

  it('shows the classic layout as the value when nothing is stored', () => {
    render(<ExperienceSwitcher />);
    expect(getSwitcher()).toHaveValue('classic');
  });

  it('shows the active theme as the value on the OneDrive layout', () => {
    localStorage.setItem(LAYOUT_KEY, 'onedrive');
    localStorage.setItem(THEME_KEY, 'gdrive');
    render(<ExperienceSwitcher />);
    expect(getSwitcher()).toHaveValue('gdrive');
  });

  it('stays on the classic value while the classic layout wears a stored theme', () => {
    localStorage.setItem(THEME_KEY, 'gdrive');
    render(<ExperienceSwitcher />);
    expect(getSwitcher()).toHaveValue('classic');
  });

  it('picking Google Drive writes both preferences and applies the theme attribute', () => {
    render(<ExperienceSwitcher />);
    fireEvent.change(getSwitcher(), { target: { value: 'gdrive' } });

    expect(localStorage.getItem(LAYOUT_KEY)).toBe('onedrive');
    expect(localStorage.getItem(THEME_KEY)).toBe('gdrive');
    expect(document.documentElement.getAttribute('data-theme')).toBe('gdrive');
    expect(getSwitcher()).toHaveValue('gdrive');
  });

  it('picking Classic moves only the layout axis', () => {
    localStorage.setItem(LAYOUT_KEY, 'onedrive');
    localStorage.setItem(THEME_KEY, 'gdrive');
    render(<ExperienceSwitcher />);

    fireEvent.change(getSwitcher(), { target: { value: 'classic' } });

    expect(localStorage.getItem(LAYOUT_KEY)).toBe('classic');
    expect(localStorage.getItem(THEME_KEY)).toBe('gdrive');
    expect(getSwitcher()).toHaveValue('classic');
  });

  it('ignores a value that is not an experience', () => {
    render(<ExperienceSwitcher />);
    const switcher = getSwitcher();
    // A select cannot offer an unknown value, but the change handler guards
    // untyped DOM values rather than trusting them.
    fireEvent.change(switcher, { target: { value: 'onedrive' } });

    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
});
