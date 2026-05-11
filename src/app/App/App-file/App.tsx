/**
 * Root application module providing Solid LDO context and layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useSolidAuth, BrowserSolidLdoProvider } from '@ldo/solid-react';
import { Header } from '@/features/auth/components/Header';
import { FileExplorer } from '@/features/file-explorer/components/FileExplorer';
import { ProfileSidebar } from '@/features/profile/components/ProfileSidebar';
import { NotificationProvider } from '@/shared/contexts/NotificationContext';
import './github-fork-ribbon.css';
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
    <app-layout>
      <ProfileSidebar />
      <main className="app-main">
        <FileExplorer />
      </main>
    </app-layout>
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
const GITHUB_REPO_URL =
  'https://github.com/WSE-research/Solid-Hello-World-Frontend-React';

const App: FunctionComponent = () => (
  <app-root>
    <a
      className="github-fork-ribbon fixed"
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-ribbon="Fork me on GitHub"
      title="Fork me on GitHub"
    >
      Fork me on GitHub
    </a>
    <BrowserRouter
      basename="/solid-hello-world-frontend-react"
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <BrowserSolidLdoProvider>
        <NotificationProvider>
          <Header />
          <AppContent />
        </NotificationProvider>
      </BrowserSolidLdoProvider>
    </BrowserRouter>
  </app-root>
);

export default App;
