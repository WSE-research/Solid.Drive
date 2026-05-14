/**
 * Classic two pane layout: sidebar with profile + file explorer main panel.
 * This is the application's pre-existing logged-in layout, extracted into its
 * own component so App.tsx can switch between layouts.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { ProfileSidebar } from '@/features/profile/components/ProfileSidebar';
import { FileExplorer } from '@/features/file-explorer/components/FileExplorer';

/**
 * Renders the classic Solid Hello World layout: profile sidebar plus file explorer.
 *
 * @public
 */
export const ClassicLayout: FunctionComponent = () => (
  <app-layout>
    <ProfileSidebar />
    <main className="app-main">
      <FileExplorer />
    </main>
  </app-layout>
);
