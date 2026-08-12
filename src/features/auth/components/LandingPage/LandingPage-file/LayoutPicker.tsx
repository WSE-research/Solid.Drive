import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES, type Theme } from '@/features/onedrive-layout';

/**
 * What the landing page lets the user pick. The classic layout is one
 * experience; every theme of the OneDrive shell is its own experience
 * card, so ALL available themes are visible before login — the theme
 * axis is not a hidden second step behind an "OneDrive" card.
 */
export type Experience = 'classic' | Theme;

interface ExperienceOption {
  readonly value: Experience;
  readonly labelKey: string;
}

interface LayoutPickerProps {
  readonly headingId: string;
  readonly value: Experience;
  readonly onChange: (value: Experience) => void;
}

/**
 * Label key per theme. A `Record<Theme, string>` on purpose: when a
 * fourth theme joins the union, this line stops compiling until the
 * theme gets a landing card label — the picker cannot silently fall
 * behind the theme list, mirroring the guard in ThemeToggle.
 */
const THEME_LABEL_KEYS: Record<Theme, string> = {
  light: 'landing.layoutPicker.onedriveLight.label',
  dark: 'landing.layoutPicker.onedriveDark.label',
  dropbox: 'landing.layoutPicker.dropbox.label',
  gdrive: 'landing.layoutPicker.gdrive.label',
};

/* Derived from THEMES so a new theme appears here by construction, in
   the same order the in-app theme select offers it. */
const EXPERIENCE_OPTIONS: readonly ExperienceOption[] = [
  {
    value: 'classic',
    labelKey: 'landing.layoutPicker.classic.label',
  },
  ...THEMES.map((theme) => ({
    value: theme,
    labelKey: THEME_LABEL_KEYS[theme],
  })),
];

const buildCardClassName = (active: boolean): string =>
  active
    ? 'landing__layout-card landing__layout-card--active'
    : 'landing__layout-card';

export const LayoutPicker: FunctionComponent<LayoutPickerProps> = ({
  headingId,
  value,
  onChange,
}) => {
  const [translate] = useTranslation();
  const heading = translate('landing.layoutPicker.heading');
  const hint = translate('landing.layoutPicker.hint');

  return (
    <section className="landing__card" aria-labelledby={headingId}>
      <landing-card-header>
        <h2 id={headingId} className="landing__card-title">
          {heading}
        </h2>
        <p className="landing__card-lead">{hint}</p>
      </landing-card-header>
      <landing-layout-grid role="radiogroup" aria-labelledby={headingId}>
        {EXPERIENCE_OPTIONS.map((option) => {
          const isActive = option.value === value;
          const cardClassName = buildCardClassName(isActive);
          const handleClick = () => onChange(option.value);

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={cardClassName}
              onClick={handleClick}
            >
              <landing-layout-radio aria-hidden="true" />
              <landing-layout-info>
                <span className="landing__layout-label">
                  {translate(option.labelKey)}
                </span>
              </landing-layout-info>
            </button>
          );
        })}
      </landing-layout-grid>
    </section>
  );
};
