import type { FunctionComponent } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoUrl from '@/assets/solid-drive-logo.png';
import { APP_NAME } from '@/config';
import { LanguageSwitcher } from '@/features/auth/components/LanguageSwitcher';

const buildNavLinkClassName = ({ isActive }: { isActive: boolean }): string =>
  isActive
    ? 'landing__hero-nav-link landing__hero-nav-link--active'
    : 'landing__hero-nav-link';

export const LandingTopBar: FunctionComponent = () => {
  const [translate] = useTranslation();
  const logoAlt = translate('landing.logoAlt');
  const navLabel = translate('landing.hero.nav.label');
  const navOnboarding = translate('landing.hero.nav.onboarding');
  const navVideo = translate('landing.hero.nav.video');

  return (
    <landing-hero-topbar>
      <Link className="landing__brand-link" to="/" aria-label={APP_NAME}>
        <landing-hero-brand-row>
          <landing-logo-wrap>
            <img className="landing__logo" src={logoUrl} alt={logoAlt} />
          </landing-logo-wrap>
        </landing-hero-brand-row>
      </Link>
      <nav className="landing__hero-nav" aria-label={navLabel}>
        <NavLink className={buildNavLinkClassName} to="/no-pod" end>
          {navOnboarding}
        </NavLink>
        <NavLink className={buildNavLinkClassName} to="/video" end>
          {navVideo}
        </NavLink>
        <LanguageSwitcher />
      </nav>
    </landing-hero-topbar>
  );
};
