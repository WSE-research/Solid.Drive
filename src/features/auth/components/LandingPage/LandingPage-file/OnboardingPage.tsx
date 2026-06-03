import type { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const STEP_KEYS = [
  'landing.onboarding.step1',
  'landing.onboarding.step2',
  'landing.onboarding.step3',
  'landing.onboarding.step4',
] as const;

export const OnboardingPage: FunctionComponent = () => {
  const [translate] = useTranslation();
  const heading = translate('landing.onboarding.heading');
  const lead = translate('landing.onboarding.lead');
  const backLabel = translate('landing.pages.back');
  const videoLinkLabel = translate('landing.onboarding.videoLink');

  return (
    <landing-hero-brand>
      <Link className="landing__page-back" to="/">
        {backLabel}
      </Link>
      <h1 className="landing__title landing__title--page">{heading}</h1>
      <p className="landing__subtitle">{lead}</p>
      <ol className="landing__steps landing__steps--page">
        {STEP_KEYS.map((stepKey, index) => (
          <li key={stepKey} className="landing__step">
            <span className="landing__step-badge" aria-hidden="true">
              {index + 1}
            </span>
            <span className="landing__step-text">{translate(stepKey)}</span>
          </li>
        ))}
      </ol>
      <Link className="landing__steps-video-link" to="/video">
        {videoLinkLabel}
      </Link>
    </landing-hero-brand>
  );
};
