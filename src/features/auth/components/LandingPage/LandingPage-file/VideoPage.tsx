import type { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const VideoPage: FunctionComponent = () => {
  const [translate] = useTranslation();
  const heading = translate('landing.pages.video.title');
  const lead = translate('landing.pages.video.lead');
  const backLabel = translate('landing.pages.back');
  const videoCaption = translate('landing.onboarding.videoCaption');
  const videoAria = translate('landing.onboarding.videoAria');

  return (
    <landing-hero-brand>
      <Link className="landing__page-back" to="/">
        {backLabel}
      </Link>
      <h1 className="landing__title landing__title--page">{heading}</h1>
      <p className="landing__subtitle">{lead}</p>
      <figure className="landing__video-placeholder landing__video-placeholder--page" aria-label={videoAria}>
        <landing-video-play aria-hidden="true" />
        <figcaption className="landing__video-caption">{videoCaption}</figcaption>
      </figure>
    </landing-hero-brand>
  );
};
