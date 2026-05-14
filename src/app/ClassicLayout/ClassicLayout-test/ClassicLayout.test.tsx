import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassicLayout } from '../ClassicLayout-file/ClassicLayout';

vi.mock('@/features/profile/components/ProfileSidebar', () => ({
  ProfileSidebar: () => <div data-testid="profile-sidebar" />,
}));
vi.mock('@/features/file-explorer/components/FileExplorer', () => ({
  FileExplorer: () => <div data-testid="file-explorer" />,
}));

describe('ClassicLayout', () => {
  it('renders the app-layout element', () => {
    const { container } = render(<ClassicLayout />);
    expect(container.querySelector('app-layout')).toBeInTheDocument();
  });

  it('renders the main element with the .app-main class', () => {
    const { container } = render(<ClassicLayout />);
    expect(container.querySelector('main.app-main')).toBeInTheDocument();
  });

  it('mounts ProfileSidebar', () => {
    render(<ClassicLayout />);
    expect(screen.getByTestId('profile-sidebar')).toBeInTheDocument();
  });

  it('mounts FileExplorer inside the main element', () => {
    const { container } = render(<ClassicLayout />);
    const main = container.querySelector('main.app-main');
    expect(main).not.toBeNull();
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
    expect(main!.contains(screen.getByTestId('file-explorer'))).toBe(true);
  });
});
