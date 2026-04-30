/**
 * Root application module providing Solid LDO context and layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useSolidAuth, BrowserSolidLdoProvider } from '@ldo/solid-react';
import { Header } from '@/features/auth/components/Header';
import { FileExplorer } from '@/features/file-explorer/components/FileExplorer';
import { ClassicLayout } from '@/app/ClassicLayout';
import { useSessionContinuity } from '@/app/hooks/useSessionContinuity';
import { OneDriveLayout, useLayoutPreference } from '@/features/onedrive-layout';
import { NotificationProvider } from '@/shared/contexts/NotificationContext';
import './App.css';

/**
 * Renders the appropriate shell — OneDriveLayout in immersive mode, otherwise
 * the classic Header + content stack.
 *
 * @internal
 */
const AppShell: FunctionComponent = () => {
  const { session } = useSolidAuth();
  const [layout] = useLayoutPreference();
  const assumeLoggedIn = useSessionContinuity();

  if (layout === 'onedrive' && assumeLoggedIn) {
    return <OneDriveLayout />;
  }

  return (
    <>
      <Header />
      {session.isLoggedIn ? <ClassicLayout /> : <FileExplorer />}
    </>
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
    <BrowserSolidLdoProvider>
      <NotificationProvider>
        <AppShell />
      </NotificationProvider>
    </BrowserSolidLdoProvider>
  </app-root>
);

export default App;
