import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AuthCallbackSkeleton } from '../AuthCallbackSkeleton-file/AuthCallbackSkeleton';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/config', () => ({
  APP_NAME: 'soliddrive',
}));

vi.mock('@/features/auth/components/LandingPage/LandingPage-file/HeroBlob', () => ({
  HeroBlob: () => <div data-testid="hero-blob" />,
}));

vi.mock('@/features/auth/components/LandingPage/LandingPage-file/landingBrand', () => ({
  BRAND_PRIMARY: 'SOLIDDRIVE',
  BRAND_ACCENT: undefined,
  HAS_BRAND_ACCENT: false,
}));

vi.mock('../AuthCallbackSkeleton-file/AuthCallbackSkeleton.css', () => ({}));

describe('AuthCallbackSkeleton — brand without an accent', () => {
  it('renders the primary wordmark without a trailing dot or accent span', () => {
    const { container } = render(<AuthCallbackSkeleton />);
    const brand = container.querySelector('.auth-callback__brand');

    expect(brand?.textContent).toBe('SOLIDDRIVE');
    expect(brand?.querySelector('.landing__title-primary')?.textContent).toBe('SOLIDDRIVE');
    expect(brand?.querySelector('.landing__title-accent')).toBeNull();
  });
});
