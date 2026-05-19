/**
 * Labeled dropdown letting the user pick the dark or light OneDrive theme.
 * Rendered inside the gear (Settings) menu as a "Theme [Light v]" row,
 * matching the OneDrive reference UI.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as Select from '@radix-ui/react-select';
import { useTranslation } from 'react-i18next';
import {
  isTheme,
  useThemePreference,
} from '@/features/onedrive-layout/hooks/useThemePreference';
import { CheckmarkIcon, ChevronDownIcon } from '@/features/onedrive-layout/icons';

/**
 * Renders the Theme select bound to the persisted theme preference.
 *
 * @public
 */
export const ThemeToggle: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [theme, setTheme] = useThemePreference();

  const handleValueChange = (value: string) => {
    if (isTheme(value)) setTheme(value);
  };

  const label = translate('oneDriveLayout.theme', 'Theme');
  const lightLabel = translate('oneDriveLayout.themeOption.light', 'Light');
  const darkLabel = translate('oneDriveLayout.themeOption.dark', 'Dark');

  return (
    <theme-toggle-row>
      <span className="theme-toggle__label">{label}</span>
      <Select.Root value={theme} onValueChange={handleValueChange}>
        <Select.Trigger className="theme-toggle__trigger" aria-label={label}>
          <Select.Value />
          <Select.Icon className="theme-toggle__chevron" aria-hidden>
            <ChevronDownIcon focusable={false} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="theme-toggle__content"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport>
              <Select.Item value="light" className="theme-toggle__item">
                <Select.ItemIndicator className="theme-toggle__item-indicator">
                  <CheckmarkIcon aria-hidden focusable={false} />
                </Select.ItemIndicator>
                <Select.ItemText>{lightLabel}</Select.ItemText>
              </Select.Item>
              <Select.Item value="dark" className="theme-toggle__item">
                <Select.ItemIndicator className="theme-toggle__item-indicator">
                  <CheckmarkIcon aria-hidden focusable={false} />
                </Select.ItemIndicator>
                <Select.ItemText>{darkLabel}</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </theme-toggle-row>
  );
};
