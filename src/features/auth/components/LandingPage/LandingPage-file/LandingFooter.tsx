import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { EXTERNAL_LINKS } from '@/config';

export const LandingFooter: FunctionComponent = () => {
  const [translate] = useTranslation();
  const protocolLabel = translate('landing.footer.protocol');
  const learnMoreLabel = translate('landing.actions.learnMore');
  const learnMoreDescription = translate('landing.footer.learnMoreDescription');

  return (
    <footer className="landing__footer">
      <landing-footer-meta>
        <landing-footer-dot aria-hidden="true" />
        <span className="landing__footer-text">{protocolLabel}</span>
        <span className="landing__footer-text">
          {learnMoreDescription}
          <a
            className="landing__footer-link"
            href={EXTERNAL_LINKS.solidProjectAbout}
            target="_blank"
            rel="noopener noreferrer"
          >
            {learnMoreLabel}
          </a>
        </span>
      </landing-footer-meta>
    </footer>
  );
};
