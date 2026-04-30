/**
 * Shared view for the OneDrive inspired layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewStub } from '@/features/onedrive-layout/components/views/ViewStub';

export const SharedView: FunctionComponent = () => {
  const [translate] = useTranslation();
  return <ViewStub title={translate('oneDriveLayout.viewTitle.shared', 'Shared')} testId="shared" />;
};
