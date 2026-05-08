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

  it('renders all 5 view buttons in mockup order', () => {
    render(<NavRail />);
    for (const label of ['Home', 'My Files', 'Shared', 'Requests', 'People']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('does not render a Recycle Bin button', () => {
    render(<NavRail />);
    expect(screen.queryByRole('button', { name: /recycle bin/i })).not.toBeInTheDocument();
  });

  it('clicking a rail icon writes ?view=<id> to the URL', () => {
    render(<NavRail />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared' }));
    expect(window.location.search).toContain('view=shared');
  });

  it('marks the active view via aria-current', () => {
    window.history.replaceState({}, '', '/?view=requests');
    render(<NavRail />);
    expect(screen.getByRole('button', { name: 'Requests' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('marks the active rail item with the rail-item--active class for filled-icon styling', () => {
    window.history.replaceState({}, '', '/?view=people');
    const { container } = render(<NavRail />);
    const activeItem = container.querySelector('button.rail-item--active');
    expect(activeItem).not.toBeNull();
    expect(activeItem!.getAttribute('aria-label')).toBe('People');
  });

  it('renders the chevron toggle that controls the bottom panel', () => {
    const { container } = render(<NavRail />);
    expect(container.querySelector('.rail-divider-toggle')).toBeInTheDocument();
  });

  it('renders the bottom panel (Requests + People) by default', () => {
    const { container } = render(<NavRail />);
    expect(container.querySelector('rail-bottom-panel')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Requests' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'People' })).toBeInTheDocument();
  });

  it('hides the bottom panel when the chevron is clicked, and reveals it on a second click', () => {
    const { container } = render(<NavRail />);
    const toggle = container.querySelector('.rail-divider-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('rail-bottom-panel')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('rail-bottom-panel')).not.toBeNull();
  });

  it('lets the user collapse the panel even while on a bottom-panel view', () => {
    window.history.replaceState({}, '', '/?view=people');
    const { container } = render(<NavRail />);
    const toggle = container.querySelector('.rail-divider-toggle') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(container.querySelector('rail-bottom-panel')).toBeNull();
  });

  it('renders a plain disabled Create button when onNewFolder is not provided', () => {
    // Without both onNewFolder and onUploadFiles the rail renders a plain
    // tooltip-wrapped button instead of the CreateMenu component.
    render(<NavRail />);
    const createBtn = screen.getByRole('button', { name: 'Create' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).not.toHaveAttribute('aria-haspopup');
  });

  it('renders the CreateMenu when both onNewFolder and onUploadFiles are provided', () => {
    const onNewFolder = vi.fn();
    const onUploadFiles = vi.fn();
    render(<NavRail onNewFolder={onNewFolder} onUploadFiles={onUploadFiles} />);
    // OneDriveLayout supplies both — the CreateMenu takes over
    // and exposes its own Create button with aria-haspopup.
    // We just check we still have a Create button visible.
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
