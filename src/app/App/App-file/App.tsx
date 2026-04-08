/**
 * Root application module providing Solid LDO context and layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useSolidAuth, BrowserSolidLdoProvider } from '@ldo/solid-react';
import { Header } from '@/features/auth/components/Header';
import { FileExplorer } from '@/features/file-explorer/components/FileExplorer';
import { ProfileSidebar } from '@/features/profile/components/ProfileSidebar';
import { NotificationProvider } from '@/shared/contexts/NotificationContext';
import './App.css';

/**
 * Renders the main content area based on authentication state.
 * Shows sidebar layout when logged in, simple explorer when logged out.
 *
 * @internal
 */
const AppContent: FunctionComponent = () => {
  const { session } = useSolidAuth();
  return session.isLoggedIn ? (
    <div className="app-layout">
      <ProfileSidebar />
      <main className="app-main">
        <FileExplorer />
      </main>
    </div>
  ) : (
    <FileExplorer />
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
  <div className="App">
    <BrowserSolidLdoProvider>
      <NotificationProvider>
        <Header />
        <AppContent />
      </NotificationProvider>
    </BrowserSolidLdoProvider>
  </div>
);

export default App;
