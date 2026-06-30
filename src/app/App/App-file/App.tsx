/**
 * Root application module providing Solid LDO context and layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useSolidAuth, BrowserSolidLdoProvider } from '@ldo/solid-react';
import { ROUTER_BASENAME } from '@/config';
import { Header } from '@/features/auth/components/Header';
import { LandingPage } from '@/features/auth/components/LandingPage';
import { ClassicLayout } from '@/app/ClassicLayout';
import { AuthCallbackSkeleton } from '@/app/AuthCallbackSkeleton';
import { useSessionContinuity } from '@/app/hooks/useSessionContinuity';
import { OneDriveLayout, useLayoutPreference, type Layout } from '@/features/onedrive-layout';
import { NotificationProvider } from '@/shared/contexts/NotificationContext';
import { RequestNotificationsGate } from '@/app/RequestNotificationsGate';
import './App.css';

// Layouts that take over the full viewport while the user is signed in.
// Add a new entry to wire a new immersive layout, no other change to
// AppShell is required.
const IMMERSIVE_LAYOUTS: Partial<Record<Layout, FunctionComponent>> = {
  onedrive: OneDriveLayout,
};

/**
 * Picks the active shell: the auth-callback skeleton while the OIDC
 * handshake is in flight (and through a short boot window after it
 * resolves so the next layout has time to start loading), the
 * LandingPage when fully logged out, an immersive layout when one is
 * registered for the active preference, otherwise the classic Header
 * + content stack.
 */
const renderShell = (
  isLoggedIn: boolean,
  assumeLoggedIn: boolean,
  isAuthenticating: boolean,
  layout: Layout,
): ReactNode => {
  if (isAuthenticating) {
    return <AuthCallbackSkeleton />;
  }

  if (!isLoggedIn && !assumeLoggedIn) {
    return <LandingPage />;
  }

  const ImmersiveLayout = IMMERSIVE_LAYOUTS[layout];
  if (ImmersiveLayout && assumeLoggedIn) {
    return <ImmersiveLayout />;
  }

  return (
    <>
      <Header />
      <ClassicLayout />
    </>
  );
};

/**
 * Hosts the single {@link RequestNotificationsGate} mount and delegates
 * shell selection to {@link renderShell}. Keeping the gate at the root
 * means its inbox subscription is not torn down and re-opened when the
 * user transitions between landing, classic, and immersive shells.
 *
 * @internal
 */
const AppShell: FunctionComponent = () => {
  const { session } = useSolidAuth();
  const [layout] = useLayoutPreference();
  const { assumeLoggedIn, isAuthenticating } = useSessionContinuity();

  return (
    <RequestNotificationsGate>
      {renderShell(session.isActive, assumeLoggedIn, isAuthenticating, layout)}
    </RequestNotificationsGate>
  );
};

/**
 * Root application component.
 * Wraps the app with BrowserSolidLdoProvider for Solid authentication
 * and NotificationProvider for toast/confirm dialogs.
 *
 * @public
 */
const App: FunctionComponent = () => (
  <app-root>
    <BrowserRouter
      basename={ROUTER_BASENAME}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <BrowserSolidLdoProvider>
        <NotificationProvider>
          <AppShell />
        </NotificationProvider>
      </BrowserSolidLdoProvider>
    </BrowserRouter>
  </app-root>
);

export default App;
