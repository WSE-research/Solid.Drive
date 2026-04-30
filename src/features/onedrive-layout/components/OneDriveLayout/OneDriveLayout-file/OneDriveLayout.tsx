/**
 * Top-level shell for the OneDrive-inspired layout.
 * Composes the NavRail, TopBar, and the active view based on ?view=.
 *
 * @packageDocumentation
 */

import type { ComponentType, FunctionComponent } from 'react';
import { useState } from 'react';
import { NavRail } from '@/features/onedrive-layout/components/NavRail';
import { TopBar } from '@/features/onedrive-layout/components/TopBar';
import { RecentView } from '@/features/onedrive-layout/components/views/RecentView';
import { MyFilesView } from '@/features/onedrive-layout/components/views/MyFilesView';
import { SharedView } from '@/features/onedrive-layout/components/views/SharedView';
import { RequestsView } from '@/features/onedrive-layout/components/views/RequestsView';
import { RecycleBinView } from '@/features/onedrive-layout/components/views/RecycleBinView';
import { PeopleView } from '@/features/onedrive-layout/components/views/PeopleView';
import {
  useViewParam,
  type ViewId,
} from '@/features/onedrive-layout/hooks/useViewParam';
import '@/features/onedrive-layout/OneDriveLayout.css';

const VIEWS: Record<ViewId, ComponentType> = {
  recent:    RecentView,
  'my-files': MyFilesView,
  shared:    SharedView,
  requests:  RequestsView,
  bin:       RecycleBinView,
  people:    PeopleView,
};

/**
 * Renders the OneDrive-inspired application shell.
 *
 * @public
 */
export const OneDriveLayout: FunctionComponent = () => {
  const [view] = useViewParam();
  const [searchValue, setSearchValue] = useState('');
  const ActiveView = VIEWS[view];

  return (
    <onedrive-layout data-testid="onedrive-layout-root">
      <TopBar searchValue={searchValue} onSearchChange={setSearchValue} />
      <NavRail />
      <main data-view={view} className="odl-main">
        <ActiveView />
      </main>
    </onedrive-layout>
  );
};
