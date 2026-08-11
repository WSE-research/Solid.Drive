import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Layout } from '@/features/onedrive-layout';

/**
 * What the landing page lets the user pick. An experience is a layout
 * plus, for `dropbox`, the theme that restyles the OneDrive shell — the
 * Dropbox-inspired look is not a third layout, so offering it here as a
 * peer card is the only way to make it visible before login.
 */
export type Experience = Layout | 'dropbox';

interface ExperienceOption {
  readonly value: Experience;
  readonly labelKey: string;
}

interface LayoutPickerProps {
  readonly headingId: string;
  readonly value: Experience;
  readonly onChange: (value: Experience) => void;
}

const EXPERIENCE_OPTIONS: readonly ExperienceOption[] = [
  {
    value: 'classic',
    labelKey: 'landing.layoutPicker.classic.label',
  },

  {
    value: 'onedrive',
    labelKey: 'landing.layoutPicker.onedrive.label',
  },

  {
    value: 'dropbox',
    labelKey: 'landing.layoutPicker.dropbox.label',
  },
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
