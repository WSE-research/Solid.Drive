/**
 * Multi-select chip row that filters the SharedView by file format.
 *
 * Chips are not hardcoded — the parent passes in a chip set derived
 * from the actual entries observed in the user's shared catalogs (see
 * {@link deriveChipsFromEntries}). The row always leads with an "All"
 * chip that highlights when the selection is empty.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import type { FilterChipDef } from './chipCatalog';

/**
 * Props for {@link TypeFilterChips}.
 *
 * @public
 */
export interface TypeFilterChipsProps {
  /** Derived chip set (one per observed type). */
  chips: readonly FilterChipDef[];
  /** Set of currently selected chip ids. Empty = "all". */
  selected: ReadonlySet<string>;
  /** Toggles a single chip. */
  onToggle: (chipId: string) => void;
  /** Clears the selection (returns to "all"). */
  onReset: () => void;
}

/**
 * Renders the chip row.
 *
 * @public
 */
export const TypeFilterChips: FunctionComponent<TypeFilterChipsProps> = ({
  chips,
  selected,
  onToggle,
  onReset,
}) => {
  const [translate] = useTranslation();
  const allActive = selected.size === 0;

  return (
    <type-filter-chips
      role="group"
      aria-label={translate('oneDriveLayout.filters.typeGroup', 'File type filter')}
    >
      <button
        type="button"
        className={`odl-filter-chip${allActive ? ' odl-filter-chip--active' : ''}`}
        aria-pressed={allActive}
        onClick={onReset}
      >
        <span className="odl-filter-chip__label">
          {translate('oneDriveLayout.filters.allTypes', 'All')}
        </span>
      </button>
      {chips.map((chip) => {
        const active = selected.has(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            className={`odl-filter-chip odl-filter-chip--with-icon${active ? ' odl-filter-chip--active' : ''}`}
            aria-pressed={active}
            onClick={() => onToggle(chip.id)}
          >
            <span className="odl-filter-chip__icon" aria-hidden>
              <chip.Icon />
            </span>
            <span className="odl-filter-chip__label">{chip.label}</span>
          </button>
        );
      })}
    </type-filter-chips>
  );
};
