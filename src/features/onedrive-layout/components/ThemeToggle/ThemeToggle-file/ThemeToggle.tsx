/**
 * Labeled dropdown letting the user pick a theme. Rendered inside the gear
 * (Settings) menu as a "Theme [Light v]" row, matching the OneDrive
 * reference UI.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as Select from '@radix-ui/react-select';
import { useTranslation } from 'react-i18next';
import {
  isTheme,
  THEMES,
  useThemePreference,
  type Theme,
} from '@/features/onedrive-layout/hooks/useThemePreference';
import { CheckmarkIcon, ChevronDownIcon } from '@/features/onedrive-layout/icons';

interface ThemeOptionProps {
  value: Theme;
  label: string;
}

const ThemeOption: FunctionComponent<ThemeOptionProps> = ({ value, label }) => (
  <Select.Item value={value} className="theme-toggle__item">
    <Select.ItemIndicator className="theme-toggle__item-indicator">
      <CheckmarkIcon aria-hidden focusable={false} />
    </Select.ItemIndicator>
    <Select.ItemText>{label}</Select.ItemText>
  </Select.Item>
);

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

  const triggerLabel = translate('oneDriveLayout.theme', 'Theme');
  // Derived from THEMES so adding a theme cannot leave the picker behind; the
  // labels map is keyed by Theme, so TypeScript flags a missing entry.
  const labels: Record<Theme, string> = {
    light: translate('oneDriveLayout.themeOption.light', 'Light'),
    dark: translate('oneDriveLayout.themeOption.dark', 'Dark'),
    dropbox: translate('oneDriveLayout.themeOption.dropbox', 'Dropbox'),
    gdrive: translate('oneDriveLayout.themeOption.gdrive', 'Google Drive'),
  };
  const options: ThemeOptionProps[] = THEMES.map((value) => ({
    value,
    label: labels[value],
  }));

  return (
    <theme-toggle-row>
      <Select.Root value={theme} onValueChange={handleValueChange}>
        <Select.Trigger className="theme-toggle__trigger" aria-label={triggerLabel}>
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
              {options.map((option) => (
                <ThemeOption key={option.value} value={option.value} label={option.label} />
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </theme-toggle-row>
  );
};
