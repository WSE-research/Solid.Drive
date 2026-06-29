import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PwaInstall } from '@/shared/hooks/usePwaInstall';
import { InstallAppButton } from '../InstallAppButton-file/InstallAppButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const mockUsePwaInstall = vi.fn<() => PwaInstall>();
vi.mock('@/shared/hooks/usePwaInstall', () => ({
  usePwaInstall: () => mockUsePwaInstall(),
}));

const installState = (overrides: Partial<PwaInstall> = {}): PwaInstall => ({
  canInstall: false,
  isInstalled: false,
  promptInstall: vi.fn().mockResolvedValue('accepted'),
  ...overrides,
});

describe('InstallAppButton', () => {
  beforeEach(() => mockUsePwaInstall.mockReset());

  it('renders nothing when installation is not available', () => {
    mockUsePwaInstall.mockReturnValue(installState({ canInstall: false }));
    const { container } = render(<InstallAppButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the install control when installation is available', () => {
    mockUsePwaInstall.mockReturnValue(installState({ canInstall: true }));
    render(<InstallAppButton />);
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
  });

  it('opens the native prompt when clicked', () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    mockUsePwaInstall.mockReturnValue(installState({ canInstall: true, promptInstall }));
    render(<InstallAppButton />);
    fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    expect(promptInstall).toHaveBeenCalledOnce();
  });
});
