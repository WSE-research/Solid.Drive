/**
 * Top-level shell for the OneDrive-inspired layout.
 * Owns search, sort, selection, details-open, and create-menu state and
 * composes the NavRail, TopBar, ContextualToolbar, the active view, and
 * the DetailPanel.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavRail } from '@/features/onedrive-layout/components/NavRail';
import { TopBar } from '@/features/onedrive-layout/components/TopBar';
import { ContextualToolbar } from '@/features/onedrive-layout/components/ContextualToolbar';
import { DetailPanel } from '@/features/onedrive-layout/components/DetailPanel';
import { RecentView } from '@/features/onedrive-layout/components/views/RecentView';
import { MyFilesView } from '@/features/onedrive-layout/components/views/MyFilesView';
import { SharedView } from '@/features/onedrive-layout/components/views/SharedView';
import { RequestsView } from '@/features/onedrive-layout/components/views/RequestsView';
import { PeopleView } from '@/features/onedrive-layout/components/views/PeopleView';
import { useViewParam, type ViewId } from '@/features/onedrive-layout/hooks/useViewParam';
import { useMyFilesSort } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { useSelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import '@/features/onedrive-layout/OneDriveLayout.css';

const VIEW_TITLE_KEYS: Record<ViewId, string> = {
  recent: 'oneDriveLayout.viewTitle.recent',
  'my-files': 'oneDriveLayout.viewTitle.myFiles',
  shared: 'oneDriveLayout.viewTitle.shared',
  requests: 'oneDriveLayout.viewTitle.requests',
  people: 'oneDriveLayout.viewTitle.people',
};

/**
 * Renders the OneDrive-inspired application shell.
 *
 * @public
 */
export const OneDriveLayout: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [view, setView] = useViewParam();
  const [searchValue, setSearchValue] = useState('');
  const { sort, setSort } = useMyFilesSort();
  const { selected, select, clear } = useSelectedResource();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const requestNewFolder = () => {
    setView('my-files');
    setShowNewFolder(true);
  };
  const requestUpload = () => {
    setView('my-files');
    setShowUpload(true);
  };

  // Selecting a row marks it active but does NOT open the details panel.
  // The user opens / closes the panel manually via the Details button —
  // when open, it reflects whichever row is currently selected (or shows
  // an empty hint when nothing is selected).
  // Clear selection when the active view changes, handled during render
  // to satisfy the project's react-hooks/set-state-in-effect rule.
  const [previousView, setPreviousView] = useState(view);
  if (previousView !== view) {
    setPreviousView(view);
    clear();
  }

  return (
    <onedrive-layout data-testid="onedrive-layout-root">
      <TopBar searchValue={searchValue} onSearchChange={setSearchValue} />
      <NavRail onNewFolder={requestNewFolder} onUploadFiles={requestUpload} />
      <page-header>
        <h1 className="odl-page-title">{translate(VIEW_TITLE_KEYS[view])}</h1>
        {view === 'my-files' && (
          <ContextualToolbar
            sort={sort}
            onSortChange={setSort}
            detailsOpen={detailsOpen}
            onToggleDetails={() => setDetailsOpen((open) => !open)}
          />
        )}
      </page-header>
      <main data-view={view} className="odl-main">
        {view === 'my-files' && (
          <MyFilesView
            searchValue={searchValue}
            sort={sort}
            showNewFolder={showNewFolder}
            showUpload={showUpload}
            onNewFolderDone={() => setShowNewFolder(false)}
            onUploadDone={() => setShowUpload(false)}
            onRequestUpload={() => setShowUpload(true)}
            selectedUri={selected?.uri}
            onSelect={select}
          />
        )}
        {view === 'recent' && <RecentView />}
        {view === 'shared' && <SharedView />}
        {view === 'requests' && <RequestsView />}
        {view === 'people' && <PeopleView />}
      </main>
      <DetailPanel
        open={detailsOpen}
        selected={selected}
        onClose={() => setDetailsOpen(false)}
      />
    </onedrive-layout>
  );
};
