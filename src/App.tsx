import type { FunctionComponent } from 'react';
import { Header } from './Header';
import { FileExplorer } from './FileExplorer';
import { BrowserSolidLdoProvider } from '@ldo/solid-react';
import './App.css';

const App: FunctionComponent = () => {
  return (
    <div className="App">
      <BrowserSolidLdoProvider>
        <Header />
        <FileExplorer />
      </BrowserSolidLdoProvider>
    </div>
  );
}

export default App;