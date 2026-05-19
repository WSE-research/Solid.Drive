/**
 * Segmented control letting the user opt into the OneDrive-inspired layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useTranslation } from 'react-i18next';
import {
  isLayout,
  useLayoutPreference,
} from '@/features/onedrive-layout/hooks/useLayoutPreference';
import './LayoutToggle.css';

/**
 * Renders Classic | OneDrive pills bound to the persisted layout preference.
 *
 * @public
 */
export const LayoutToggle: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [layout, setLayout] = useLayoutPreference();

  const handleValueChange = (value: string) => {
    if (value && isLayout(value)) setLayout(value);
  };

  return (
    <ToggleGroup.Root
      type="single"
      value={layout}
      onValueChange={handleValueChange}
      aria-label={translate('oneDriveLayout.layout', 'Layout')}
      className="layout-toggle"
    >
      <ToggleGroup.Item value="classic" className="layout-toggle__pill">
        {translate('oneDriveLayout.classic', 'Classic')}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="onedrive" className="layout-toggle__pill">
        {translate('oneDriveLayout.onedrive', 'OneDrive')}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
};
