import { useRef, type FunctionComponent } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useSolidAuth } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { EXTERNAL_LINKS } from '@/config';
import { useIssuerSelection } from '@/features/auth/hooks/useIssuerSelection';
import { useResizeObserver } from '@/features/auth/hooks/useResizeObserver';
import { useLayoutPreference } from '@/features/onedrive-layout';
import { HeroBlob } from './HeroBlob';
import { LandingHero } from './LandingHero';
import { LandingTopBar } from './LandingTopBar';
import { OnboardingPage } from './OnboardingPage';
import { VideoPage } from './VideoPage';
import { ProviderPicker } from './ProviderPicker';
import { CustomIssuerField } from './CustomIssuerField';
import { LayoutPicker } from './LayoutPicker';
import { LandingFooter } from './LandingFooter';
import '@/app/App/App-file/github-fork-ribbon.css';
import './LandingPage.css';

const TITLE_ID = 'landing-title';
const PROVIDERS_HEADING_ID = 'landing-providers-heading';
const CUSTOM_HEADING_ID = 'landing-custom-heading';
const LAYOUT_HEADING_ID = 'landing-layout-heading';
const NARROW_BREAKPOINT_PX = 860;
const COMPACT_BREAKPOINT_PX = 600;
const PHONE_BREAKPOINT_PX = 480;
const ONBOARDING_ROUTE = 'no-pod';
const VIDEO_ROUTE = 'video';

export const LandingPage: FunctionComponent = () => {
  const { login } = useSolidAuth();
  const [translate] = useTranslation();
  const [layout, setLayout] = useLayoutPreference();
  const selection = useIssuerSelection();
  const landingRef = useRef<HTMLElement>(null);
  const { width: landingWidth } = useResizeObserver(landingRef);

  const hasMeasured = landingWidth > 0;
  const isNarrowScreen = hasMeasured && landingWidth <= NARROW_BREAKPOINT_PX;
  const isCompactScreen = hasMeasured && landingWidth <= COMPACT_BREAKPOINT_PX;
  const isPhoneScreen = hasMeasured && landingWidth <= PHONE_BREAKPOINT_PX;

  const recommendedValue = selection.providerCards[0]?.value;
  const registrationUrl =
    selection.activeProvider?.registerUrl ?? EXTERNAL_LINKS.defaultGetPod;
  const loginDisabled = selection.activeIssuerUrl.length === 0;

  const loginLabel = translate('landing.actions.login');
  const loginAriaLabel = translate('landing.actions.loginAria');
  const createPodLabel = translate('landing.actions.createPod');
  const forkRibbonLabel = translate('landing.forkRibbon.label');

  const handleLogin = () => {
    if (loginDisabled) return;
    void login(selection.activeIssuerUrl);
  };

  const heroSignIn = (
    <>
      <LandingHero titleId={TITLE_ID} />

      <landing-hero-form>
        <ProviderPicker
          headingId={PROVIDERS_HEADING_ID}
          providers={selection.providerCards}
          recommendedValue={recommendedValue}
          selectedValue={selection.selectedProviderValue}
          onSelect={selection.selectProvider}
        />

        <CustomIssuerField
          headingId={CUSTOM_HEADING_ID}
          value={selection.customIssuerValue}
          hasValue={selection.hasCustomIssuer}
          hasError={selection.customIssuerError}
          onChange={selection.setCustomIssuer}
        />

        <LayoutPicker
          headingId={LAYOUT_HEADING_ID}
          value={layout}
          onChange={setLayout}
        />
      </landing-hero-form>

      <landing-hero-actions>
        <a
          className="landing__hero-secondary"
          href={registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {createPodLabel}
        </a>
        <button
          type="button"
          className="landing__hero-login"
          onClick={handleLogin}
          disabled={loginDisabled}
          aria-label={loginAriaLabel}
        >
          {loginLabel}
        </button>
      </landing-hero-actions>
    </>
  );

  return (
    <main
      ref={landingRef}
      className="landing"
      data-narrow={isNarrowScreen || undefined}
      data-compact={isCompactScreen || undefined}
      data-phone={isPhoneScreen || undefined}
    >
      <landing-shell>
        <a
          className="github-fork-ribbon landing__fork-ribbon"
          href={EXTERNAL_LINKS.githubRepo}
          target="_blank"
          rel="noopener noreferrer"
          data-ribbon={forkRibbonLabel}
          title={forkRibbonLabel}
        >
          {forkRibbonLabel}
        </a>

        <section className="landing__hero" aria-labelledby={TITLE_ID}>
          <landing-hero-left>
            <LandingTopBar />

            <Routes>
              <Route index element={heroSignIn} />
              <Route path={ONBOARDING_ROUTE} element={<OnboardingPage />} />
              <Route path={VIDEO_ROUTE} element={<VideoPage />} />
            </Routes>
          </landing-hero-left>

          <landing-hero-right aria-hidden="true">
            <HeroBlob />
          </landing-hero-right>
        </section>

        <LandingFooter />
      </landing-shell>
    </main>
  );
};
