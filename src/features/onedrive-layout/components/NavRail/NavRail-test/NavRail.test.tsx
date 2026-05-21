import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavRail } from '../NavRail-file/NavRail';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => {
      const map: Record<string, string> = {
        'oneDriveLayout.navRail': 'Navigation',
        'oneDriveLayout.navRailCollapse': 'Collapse',
        'oneDriveLayout.navRailExpand': 'Expand',
        'oneDriveLayout.create': 'Create',
        'oneDriveLayout.createOrUpload': 'Create or upload',
        'oneDriveLayout.browseFilesBy': 'Browse files by',
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

const resetState = () => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
};

describe('NavRail (expanded pane)', () => {
  beforeEach(resetState);

  it('renders the expanded Create or upload pill by default', () => {
    render(<NavRail accountName="Parnian" />);
    expect(
      screen.getByRole('button', { name: 'Create or upload' }),
    ).toBeInTheDocument();
  });

  it('shows the account header with the user display name', () => {
    render(<NavRail accountName="Parnian Hajian" />);
    expect(screen.getByText('Parnian Hajian')).toBeInTheDocument();
  });

  it('renders all 5 view labels in expanded mode', () => {
    render(<NavRail accountName="Parnian" />);
    for (const label of ['Home', 'My Files', 'Shared', 'Requests', 'People']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('does not render a Recycle Bin entry', () => {
    render(<NavRail accountName="Parnian" />);
    expect(
      screen.queryByRole('button', { name: /recycle bin/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a Collapse toggle that switches to icon-only rail', () => {
    const { container } = render(<NavRail accountName="Parnian" />);
    expect(container.querySelector('nav-rail')?.getAttribute('data-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));

    expect(container.querySelector('nav-rail')?.getAttribute('data-expanded')).toBe('false');
  });

  it('persists the collapsed state to localStorage', () => {
    render(<NavRail accountName="Parnian" />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(localStorage.getItem('solid-drive.navRailExpanded')).toBe('false');
  });

  it('clicking a nav item writes ?view=<id> to the URL', () => {
    render(<NavRail accountName="Parnian" />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared' }));
    expect(window.location.search).toContain('view=shared');
  });

  it('marks the active view with aria-current and the active class', () => {
    window.history.replaceState({}, '', '/?view=people');
    const { container } = render(<NavRail accountName="Parnian" />);
    expect(
      screen.getByRole('button', { name: 'People' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(container.querySelector('button.rail-item--active')?.getAttribute('aria-label')).toBe(
      'People',
    );
  });
});

describe('NavRail (collapsed icon rail)', () => {
  beforeEach(() => {
    resetState();
    localStorage.setItem('solid-drive.navRailExpanded', 'false');
  });

  it('renders an Expand toggle that switches back to the pane', () => {
    const { container } = render(<NavRail />);
    expect(container.querySelector('nav-rail')?.getAttribute('data-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(container.querySelector('nav-rail')?.getAttribute('data-expanded')).toBe('true');
  });

  it('renders the create button without the long label text', () => {
    render(<NavRail />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.queryByText('Create or upload')).not.toBeInTheDocument();
  });

  it('renders all 5 view buttons as icon-only with aria-labels', () => {
    render(<NavRail />);
    for (const label of ['Home', 'My Files', 'Shared', 'Requests', 'People']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('does not render the account name text', () => {
    render(<NavRail accountName="Parnian Hajian" />);
    expect(screen.queryByText('Parnian Hajian')).not.toBeInTheDocument();
  });
});

describe('NavRail (shared behavior)', () => {
  beforeEach(resetState);

  it('renders the chevron toggle that controls the bottom panel', () => {
    const { container } = render(<NavRail accountName="Parnian" />);
    expect(
      container.querySelector('[aria-controls="rail-bottom-panel"]'),
    ).toBeInTheDocument();
  });

  it('hides the bottom panel when the chevron is clicked, and reveals it again', () => {
    const { container } = render(<NavRail accountName="Parnian" />);
    const toggle = container.querySelector(
      '[aria-controls="rail-bottom-panel"]',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('rail-bottom-panel')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('rail-bottom-panel')).not.toBeNull();
  });

  it('renders a plain disabled Create button when callbacks are not provided', () => {
    render(<NavRail accountName="Parnian" />);
    const createBtn = screen.getByRole('button', { name: 'Create or upload' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).not.toHaveAttribute('aria-haspopup');
  });

  it('renders the full CreateMenu when both create callbacks are wired', async () => {
    const user = userEvent.setup();
    const onNewFolder = vi.fn();
    const onFilesPicked = vi.fn();
    render(
      <NavRail
        accountName="Parnian"
        onNewFolder={onNewFolder}
        onFilesPicked={onFilesPicked}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create or upload' }));
    expect(
      await screen.findByRole('menuitem', { name: /new folder/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /upload files/i }),
    ).toBeInTheDocument();
  });
});
