/**
 * Dropdown letting the user switch the whole look from the classic header:
 * the classic two-pane shell, or the OneDrive shell in any of its themes.
 *
 * A plain `<select>` on purpose — it sits next to the language switcher in
 * the classic header and inherits the same global control styling, and it
 * stays one control wide however many themes ship.
 *
 * @packageDocumentation
 */

import type { ChangeEvent, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EXPERIENCES,
  isExperience,
  useExperiencePreference,
  type Experience,
} from '@/features/onedrive-layout/hooks/useExperiencePreference';

/**
 * Renders the experience select bound to the persisted layout and theme
 * preferences.
 *
 * @public
 */
export const ExperienceSwitcher: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [experience, setExperience] = useExperiencePreference();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isExperience(value)) setExperience(value);
  };

  // Derived from EXPERIENCES so a new theme cannot leave the switcher behind;
  // the labels map is keyed by Experience, so TypeScript flags a missing entry.
  const labels: Record<Experience, string> = {
    classic: translate('oneDriveLayout.experienceOption.classic', 'Classic'),
    light: translate('oneDriveLayout.experienceOption.light', 'OneDrive (Light)'),
    dark: translate('oneDriveLayout.experienceOption.dark', 'OneDrive (Dark)'),
    dropbox: translate('oneDriveLayout.experienceOption.dropbox', 'Dropbox'),
    gdrive: translate('oneDriveLayout.experienceOption.gdrive', 'Google Drive'),
  };

  return (
    <select
      aria-label={translate('oneDriveLayout.experience', 'Experience')}
      value={experience}
      onChange={handleChange}
    >
      {EXPERIENCES.map((value) => (
        <option key={value} value={value}>
          {labels[value]}
        </option>
      ))}
    </select>
  );
};
