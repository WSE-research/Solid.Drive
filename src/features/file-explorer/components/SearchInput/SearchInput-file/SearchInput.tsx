/**
 * Controlled search input for the file explorer.
 *
 * @packageDocumentation
 */

import type { ChangeEvent, FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

/**
 * Props for the SearchInput component.
 */
interface SearchInputProps {
  value: string;
  onChange: (query: string) => void;
}

/**
 * Renders the search box shown above the file listing.
 * Owns no state; the parent decides what the query means.
 *
 * @public
 */
export const SearchInput: FunctionComponent<SearchInputProps> = ({ value, onChange }) => {
  const [translate] = useTranslation();
  const placeholder = translate("fileExplorer.searchPlaceholder");
  const clearLabel = translate("fileExplorer.searchClearLabel");

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  const handleClear = () => onChange("");

  return (
    <search-input>
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value.length > 0 && (
        <search-input-clear>
          <button type="button" aria-label={clearLabel} onClick={handleClear}>×</button>
        </search-input-clear>
      )}
    </search-input>
  );
};
