import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/config');
});

const renderHeroWithAppName = async (appName: string): Promise<void> => {
  vi.resetModules();
  vi.doMock('@/config', () => ({ APP_NAME: appName }));
  const { LandingHero } = await import('../LandingPage-file/LandingHero');
  render(<LandingHero titleId="hero-title" />);
};

describe('LandingHero — title rendering', () => {
  it('splits a dotted APP_NAME into a primary span and an accent span', async () => {
    await renderHeroWithAppName('Solid.drive');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.querySelector('.landing__title-primary')).toHaveTextContent('SOLID.');
    expect(heading.querySelector('.landing__title-accent')).toHaveTextContent('DRIVE');
  });

  it('falls back to the raw APP_NAME and skips the accent span when there is no dot', async () => {
    await renderHeroWithAppName('SolidDrive');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.querySelector('.landing__title-primary')).toHaveTextContent('SOLIDDRIVE');
    expect(heading.querySelector('.landing__title-accent')).toBeNull();
  });
});
