import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_ACCENT, BRAND_PRIMARY, HAS_BRAND_ACCENT } from './landingBrand';

interface LandingHeroProps {
  readonly titleId: string;
}

export const LandingHero: FunctionComponent<LandingHeroProps> = ({ titleId }) => {
  const [translate] = useTranslation();
  const subtitle = translate('landing.subtitle');

  return (
    <landing-hero-brand>
      <h1 id={titleId} className="landing__title">
        <span className="landing__title-primary">
          {BRAND_PRIMARY}
          {HAS_BRAND_ACCENT ? '.' : ''}
        </span>
        {HAS_BRAND_ACCENT && (
          <span className="landing__title-accent">{BRAND_ACCENT}</span>
        )}
      </h1>
      <p className="landing__subtitle">{subtitle}</p>
    </landing-hero-brand>
  );
};
