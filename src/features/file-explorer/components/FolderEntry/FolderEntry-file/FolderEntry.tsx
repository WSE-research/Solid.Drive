/**
 * Folder entry component for Pod navigation.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";

/**
 * Props for the FolderEntry component.
 */
type FolderEntryProps = {
  uri: string;
  onNavigate: (uri: string) => void;
};

/**
 * Renders a clickable folder row for navigating into a container.
 *
 * @public
 */
export const FolderEntry: FunctionComponent<FolderEntryProps> = ({ uri, onNavigate }) => {
  const name = decodeURIComponent(uri.replace(/\/$/, "").split("/").pop() ?? uri);

  return (
    <button className="folder-entry" onClick={() => onNavigate(uri)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span className="folder-entry__name">{name}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="folder-entry__arrow">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
};
