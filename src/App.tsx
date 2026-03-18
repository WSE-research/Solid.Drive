import type { FunctionComponent } from 'react';
import { useSolidAuth, BrowserSolidLdoProvider } from '@ldo/solid-react';
import { Header } from './Header';
import { FileExplorer } from './FileExplorer';
import { ProfileSidebar } from './ProfileSidebar';
import './App.css';

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

const App: FunctionComponent = () => (
  <div className="App">
    <BrowserSolidLdoProvider>
      <Header />
      <AppContent />
    </BrowserSolidLdoProvider>
  </div>
);

export default App;
