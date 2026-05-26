import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '@/config';

interface LandingHeroProps {
  readonly titleId: string;
}

const [TITLE_PRIMARY_RAW, TITLE_ACCENT_RAW] = APP_NAME.split('.');
const TITLE_PRIMARY = (TITLE_PRIMARY_RAW ?? APP_NAME).toUpperCase();
const TITLE_ACCENT = TITLE_ACCENT_RAW?.toUpperCase();
const HAS_TITLE_ACCENT = Boolean(TITLE_ACCENT);

export const LandingHero: FunctionComponent<LandingHeroProps> = ({ titleId }) => {
  const [translate] = useTranslation();
  const subtitle = translate('landing.subtitle');

  return (
    <landing-hero-brand>
      <h1 id={titleId} className="landing__title">
        <span className="landing__title-primary">
          {TITLE_PRIMARY}
          {HAS_TITLE_ACCENT ? '.' : ''}
        </span>
        {HAS_TITLE_ACCENT && (
          <span className="landing__title-accent">{TITLE_ACCENT}</span>
        )}
      </h1>
      <p className="landing__subtitle">{subtitle}</p>
    </landing-hero-brand>
  );
};
