/**
 * Shared placeholder content shown by every view in the OneDrive shell
 * before its real implementation lands.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';

interface ViewStubProps {
  title: string;
  testId: string;
}

/**
 * Empty placeholder body for a view that has no implementation yet.
 * The page title is rendered by OneDriveLayout's page header — this stub
 * keeps a `data-testid` anchor (and `data-title` for legacy tests) but
 * adds no visible content.
 *
 * @public
 */
export const ViewStub: FunctionComponent<ViewStubProps> = ({ title, testId }) => (
  <onedrive-view data-testid={`view-${testId}`} data-title={title} />
);
