/**
 * Flat list of search hits rendered in place of the folder browser
 * while the user is actively searching.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { FileCard } from "@/features/file-explorer/components/FileCard";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import type { CatalogEntry } from "@/types";

/**
 * Props for the SearchResults component.
 */
interface SearchResultsProps {
  query: string;
  results: CatalogEntry[];
  catalogUri: string;
}

/**
 * Renders the current search result set.
 *
 * @remarks
 * Shows an empty state (with the query interpolated) when `results` is empty.
 * Otherwise renders a pluralized match count (`fileExplorer.searchMatchCount`)
 * followed by one `FileCard` per hit, reusing the existing metadata render.
 *
 * @public
 */
export const SearchResults: FunctionComponent<SearchResultsProps> = ({
  query,
  results,
  catalogUri,
}) => {
  const [translate] = useTranslation();

  if (results.length === 0) {
    return (
      <empty-state>
        <empty-state-icon>◌</empty-state-icon>
        <p>{translate("fileExplorer.searchNoResults", { query })}</p>
      </empty-state>
    );
  }

  return (
    <search-results>
      <p className="search-results__count">
        {translate("fileExplorer.searchMatchCount", { count: results.length })}
      </p>
      {results.map((entry) => (
        <FileCard
          key={entry.uri}
          containerUri={toContainerUri(entry.uri)}
          catalogUri={catalogUri}
        />
      ))}
    </search-results>
  );
};
