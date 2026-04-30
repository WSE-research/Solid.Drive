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
 * Renders the bare title for a view that has no implementation yet.
 * The body is intentionally left empty until the view is wired up.
 *
 * @public
 */
export const ViewStub: FunctionComponent<ViewStubProps> = ({ title, testId }) => (
  <onedrive-view data-testid={`view-${testId}`}>
    <h1 className="odl-view-title">{title}</h1>
  </onedrive-view>
);
