import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AuthCallbackSkeleton } from '../AuthCallbackSkeleton-file/AuthCallbackSkeleton';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/config', () => ({
  APP_NAME: 'solid.drive',
}));

vi.mock('@/features/auth/components/LandingPage/LandingPage-file/HeroBlob', () => ({
  HeroBlob: () => <div data-testid="hero-blob" />,
}));

vi.mock('@/features/auth/components/LandingPage/LandingPage-file/landingBrand', () => ({
  BRAND_PRIMARY: 'SOLID',
  BRAND_ACCENT: 'DRIVE',
  HAS_BRAND_ACCENT: true,
}));

vi.mock('../AuthCallbackSkeleton-file/AuthCallbackSkeleton.css', () => ({}));

describe('AuthCallbackSkeleton', () => {
  it('renders an aria-live status region marked as busy', () => {
    const { container } = render(<AuthCallbackSkeleton />);
    const region = container.querySelector('auth-callback-skeleton');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the HeroBlob backdrop hidden from screen readers', () => {
    const { container, getByTestId } = render(<AuthCallbackSkeleton />);
    const backdrop = container.querySelector('auth-callback-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(getByTestId('hero-blob')).toBeInTheDocument();
  });

  it('renders the brand wordmark using the landing title accent styles', () => {
    const { container } = render(<AuthCallbackSkeleton />);
    const brand = container.querySelector('.auth-callback__brand');
    expect(brand?.textContent).toBe('SOLID.DRIVE');
    expect(brand?.querySelector('.landing__title-primary')?.textContent).toBe('SOLID.');
    expect(brand?.querySelector('.landing__title-accent')?.textContent).toBe('DRIVE');
  });

  it('renders the localised title and subtitle', () => {
    const { container } = render(<AuthCallbackSkeleton />);
    expect(container.querySelector('auth-callback-title')?.textContent).toBe('authCallback.title');
    expect(container.querySelector('auth-callback-subtitle')?.textContent).toBe('authCallback.subtitle');
  });

  it('renders four shimmer bars with varying widths', () => {
    const { container } = render(<AuthCallbackSkeleton />);
    const bars = container.querySelectorAll('auth-callback-bar');
    expect(bars).toHaveLength(4);
    const widths = Array.from(bars).map((bar) => (bar as HTMLElement).style.width);
    expect(new Set(widths).size).toBeGreaterThan(1);
  });
});
