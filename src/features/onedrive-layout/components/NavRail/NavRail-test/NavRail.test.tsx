import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavRail } from '../NavRail-file/NavRail';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => {
      const map: Record<string, string> = {
        'oneDriveLayout.navRail': 'Navigation',
        'oneDriveLayout.create': 'Create',
        'oneDriveLayout.recent': 'Home',
        'oneDriveLayout.myFiles': 'My Files',
        'oneDriveLayout.shared': 'Shared',
        'oneDriveLayout.requests': 'Requests',
        'oneDriveLayout.bin': 'Recycle Bin',
        'oneDriveLayout.people': 'People',
      };
      return map[key] ?? fallback ?? key;
    },
  ],
}));

describe('NavRail', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));

  it('renders the create (+) button', () => {
    render(<NavRail />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('does not render the logo (the logo lives in the top bar in the OneDrive-style layout)', () => {
    render(<NavRail />);
    expect(screen.queryByRole('img', { name: /solid\.drive/i })).not.toBeInTheDocument();
  });

  it('renders all 6 view buttons in mockup order', () => {
    render(<NavRail />);
    for (const label of ['Home', 'My Files', 'Shared', 'Requests', 'Recycle Bin', 'People']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('clicking a rail icon writes ?view=<id> to the URL', () => {
    render(<NavRail />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared' }));
    expect(window.location.search).toContain('view=shared');
  });

  it('marks the active view via aria-current', () => {
    window.history.replaceState({}, '', '/?view=bin');
    render(<NavRail />);
    expect(screen.getByRole('button', { name: 'Recycle Bin' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('marks the active rail item with the rail-item--active class for filled-icon styling', () => {
    window.history.replaceState({}, '', '/?view=people');
    const { container } = render(<NavRail />);
    const activeItem = container.querySelector('button.rail-item--active');
    expect(activeItem).not.toBeNull();
    expect(activeItem!.getAttribute('aria-label')).toBe('People');
  });

  it('renders the chevron divider between top items and the people item', () => {
    const { container } = render(<NavRail />);
    expect(container.querySelector('.rail-divider')).toBeInTheDocument();
  });
});
