/**
 * Neutral skeleton shown during the OIDC callback handshake. The Solid
 * auth provider needs a moment to exchange the authorization code for a
 * session; rather than flash the LandingPage back at the user, AppShell
 * mounts this placeholder until {@link useSessionContinuity} reports
 * that auth has resolved.
 *
 * Reuses the landing page's HeroBlob backdrop and brand wordmark so the
 * transition between LandingPage and signed-in shell feels continuous.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { HeroBlob } from '@/features/auth/components/LandingPage/LandingPage-file/HeroBlob';
import { BRAND_ACCENT, BRAND_PRIMARY, HAS_BRAND_ACCENT } from '@/features/auth/components/LandingPage/LandingPage-file/landingBrand';
import './AuthCallbackSkeleton.css';

const SHIMMER_BARS = [82, 64, 70, 58] as const;

/**
 * @public
 */
export const AuthCallbackSkeleton: FunctionComponent = () => {
  const [translate] = useTranslation();
  const title = translate('authCallback.title');
  const subtitle = translate('authCallback.subtitle');

  return (
    <auth-callback-skeleton role="status" aria-live="polite" aria-busy="true">
      <auth-callback-backdrop aria-hidden="true">
        <HeroBlob />
      </auth-callback-backdrop>

      <auth-callback-card>
        <p className="auth-callback__brand">
          <span className="landing__title-primary">
            {BRAND_PRIMARY}
            {HAS_BRAND_ACCENT ? '.' : ''}
          </span>
          {HAS_BRAND_ACCENT && (
            <span className="landing__title-accent">{BRAND_ACCENT}</span>
          )}
        </p>
        <auth-callback-title>{title}</auth-callback-title>
        <auth-callback-subtitle>{subtitle}</auth-callback-subtitle>
        <auth-callback-bars aria-hidden="true">
          {SHIMMER_BARS.map((widthPct, index) => (
            <auth-callback-bar key={index} style={{ width: `${widthPct}%` }} />
          ))}
        </auth-callback-bars>
      </auth-callback-card>
    </auth-callback-skeleton>
  );
};
