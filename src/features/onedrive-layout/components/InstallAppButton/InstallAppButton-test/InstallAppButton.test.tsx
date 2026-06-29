import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUsePwaInstall = vi.fn();

vi.mock('@/shared/hooks/usePwaInstall', () => ({
  usePwaInstall: () => mockUsePwaInstall(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

import { InstallAppButton } from '../InstallAppButton-file/InstallAppButton';

describe('InstallAppButton', () => {
  beforeEach(() => mockUsePwaInstall.mockReset());

  it('renders nothing when the app cannot be installed', () => {
    mockUsePwaInstall.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      promptInstall: vi.fn(),
    });

    const { container } = render(<InstallAppButton />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('install-app-button')).not.toBeInTheDocument();
  });

  it('renders an Install app button when installable', () => {
    mockUsePwaInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    });

    render(<InstallAppButton />);

    const button = screen.getByRole('button', { name: /install app/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-testid', 'install-app-button');
    expect(button).toHaveAttribute('title', 'Install app');
  });

  it('replays the install prompt when clicked', async () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    mockUsePwaInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall,
    });
    const user = userEvent.setup({ delay: null });

    render(<InstallAppButton />);
    await user.click(screen.getByRole('button', { name: /install app/i }));

    expect(promptInstall).toHaveBeenCalledTimes(1);
  });
});
