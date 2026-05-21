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
  const options: ThemeOptionProps[] = [
    { value: 'light', label: translate('oneDriveLayout.themeOption.light', 'Light') },
    { value: 'dark', label: translate('oneDriveLayout.themeOption.dark', 'Dark') },
  ];

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
