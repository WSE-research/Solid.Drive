/**
 * Labeled dropdown letting the user pick the OneDrive accent color
 * scheme. Rendered inside the gear (Settings) menu as a "Color [Indigo v]"
 * row, mirroring the Theme row. Reuses the `theme-toggle__*` select styles.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as Select from '@radix-ui/react-select';
import { useTranslation } from 'react-i18next';
import {
  COLOR_SCHEMES,
  isColorScheme,
  useColorScheme,
  type ColorScheme,
} from '@/features/onedrive-layout/hooks/useColorScheme';
import { CheckmarkIcon, ChevronDownIcon } from '@/features/onedrive-layout/icons';

/** Default English labels for each scheme, used as i18n fallbacks. */
const SCHEME_LABELS: Record<ColorScheme, string> = {
  indigo: 'Indigo',
  emerald: 'Emerald',
  amber: 'Amber',
  rose: 'Rose',
};

interface SchemeOptionProps {
  value: ColorScheme;
  label: string;
}

const SchemeOption: FunctionComponent<SchemeOptionProps> = ({ value, label }) => (
  <Select.Item value={value} className="theme-toggle__item">
    <Select.ItemIndicator className="theme-toggle__item-indicator">
      <CheckmarkIcon aria-hidden focusable={false} />
    </Select.ItemIndicator>
    <span className={`color-scheme-swatch color-scheme-swatch--${value}`} aria-hidden />
    <Select.ItemText>{label}</Select.ItemText>
  </Select.Item>
);

/**
 * Renders the Color scheme select bound to the persisted preference.
 *
 * @public
 */
export const ColorSchemeToggle: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [scheme, setScheme] = useColorScheme();

  const handleValueChange = (value: string) => {
    if (isColorScheme(value)) setScheme(value);
  };

  const triggerLabel = translate('oneDriveLayout.colorScheme', 'Color');
  const options: SchemeOptionProps[] = COLOR_SCHEMES.map((value) => ({
    value,
    label: translate(`oneDriveLayout.colorSchemeOption.${value}`, SCHEME_LABELS[value]),
  }));

  return (
    <color-scheme-toggle-row>
      <Select.Root value={scheme} onValueChange={handleValueChange}>
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
                <SchemeOption key={option.value} value={option.value} label={option.label} />
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </color-scheme-toggle-row>
  );
};
