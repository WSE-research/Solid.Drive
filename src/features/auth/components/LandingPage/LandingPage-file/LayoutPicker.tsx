import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { EXPERIENCES, type Experience } from '@/features/onedrive-layout';

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
 * Label key per experience. A `Record<Experience, string>` on purpose:
 * when a fifth theme joins the union, this line stops compiling until it
 * gets a landing card label — the picker cannot silently fall behind the
 * theme list, mirroring the guard in ThemeToggle and ExperienceSwitcher.
 */
const EXPERIENCE_LABEL_KEYS: Record<Experience, string> = {
  classic: 'landing.layoutPicker.classic.label',
  light: 'landing.layoutPicker.onedriveLight.label',
  dark: 'landing.layoutPicker.onedriveDark.label',
  dropbox: 'landing.layoutPicker.dropbox.label',
  gdrive: 'landing.layoutPicker.gdrive.label',
};

/* Derived from EXPERIENCES so a new theme appears here by construction,
   in the same order the in-app switchers offer it. */
const EXPERIENCE_OPTIONS: readonly ExperienceOption[] = EXPERIENCES.map((value) => ({
  value,
  labelKey: EXPERIENCE_LABEL_KEYS[value],
}));

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
