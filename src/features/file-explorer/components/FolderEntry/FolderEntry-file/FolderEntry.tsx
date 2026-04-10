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
  const segments = uri.replace(/\/$/, "").split("/");
  const name = decodeURIComponent(segments[segments.length - 1]);

  return (
    <button className="folder-entry" onClick={() => onNavigate(uri)}>
      <span className="icon--folder" />
      <span className="folder-entry__name">{name}</span>
      <span className="folder-entry__arrow" />
    </button>
  );
};
