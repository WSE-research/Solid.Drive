/**
 * Free-text input that filters a list of contacts by display name or
 * WebID. Stateless — the parent owns the value via {@link useSharedFilters}.
 *
 * @packageDocumentation
 */

import type { ChangeEvent, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Props for {@link PersonNameFilter}.
 *
 * @public
 */
export interface PersonNameFilterProps {
  /** Current query string. */
  value: string;
  /** Fires whenever the user edits the input. */
  onChange: (next: string) => void;
}

/**
 * Renders the person/name search input with a leading icon-style label.
 *
 * @public
 */
export const PersonNameFilter: FunctionComponent<PersonNameFilterProps> = ({
  value,
  onChange,
}) => {
  const [translate] = useTranslation();
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <person-name-filter>
      <input
        type="search"
        className="odl-filter-input"
        placeholder={translate(
          'oneDriveLayout.filters.personPlaceholder',
          'Filter by name or WebID',
        )}
        aria-label={translate(
          'oneDriveLayout.filters.personPlaceholder',
          'Filter by name or WebID',
        )}
        value={value}
        onChange={handleChange}
      />
    </person-name-filter>
  );
};
