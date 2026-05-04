import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OneDriveLayout } from '../OneDriveLayout-file/OneDriveLayout';

vi.mock('@/features/onedrive-layout/components/NavRail', () => ({
  NavRail: () => <nav-rail data-testid="nav-rail" />,
}));

vi.mock('@/features/onedrive-layout/components/TopBar', () => ({
  TopBar: ({ searchValue }: { searchValue: string }) => (
    <top-bar data-testid="top-bar" data-search={searchValue} />
  ),
}));

vi.mock('@/features/onedrive-layout/components/views/MyFilesView', () => ({
  MyFilesView: () => <div data-testid="view-my-files" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

describe('OneDriveLayout', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));

  it('renders the rail and the top bar', () => {
    render(<OneDriveLayout />);
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
  });

  it('renders the onedrive-layout root element', () => {
    const { container } = render(<OneDriveLayout />);
    expect(container.querySelector('onedrive-layout')).toBeInTheDocument();
  });

  it('defaults to the recent (Home) view', () => {
    render(<OneDriveLayout />);
    expect(screen.getByTestId('view-recent')).toBeInTheDocument();
  });

  it.each([
    ['my-files', 'view-my-files'],
    ['shared', 'view-shared'],
    ['requests', 'view-requests'],
    ['people', 'view-people'],
  ])('renders the right view when ?view=%s', (param, testId) => {
    window.history.replaceState({}, '', `/?view=${param}`);
    render(<OneDriveLayout />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('falls back to the recent view on an unknown ?view= value', () => {
    window.history.replaceState({}, '', '/?view=banana');
    render(<OneDriveLayout />);
    expect(screen.getByTestId('view-recent')).toBeInTheDocument();
  });
});
