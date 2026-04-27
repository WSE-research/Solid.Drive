/**
 * Folder entry component for Pod navigation.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { DragEvent, FunctionComponent } from "react";

interface FolderEntryProps {
  uri: string;
  onNavigate: (uri: string) => void;
  onDrop?: (files: File[], targetUri: string, dataTransfer: DataTransfer | null) => void;
  onDragOverChange?: (isOver: boolean) => void;
}

/**
 * Renders a clickable folder row for navigating into a container.
 * When `onDrop` and `onDragOverChange` are provided, the row also acts as
 * a drag-and-drop target for files from the desktop.
 *
 * @public
 */
export const FolderEntry: FunctionComponent<FolderEntryProps> = ({ uri, onNavigate, onDrop, onDragOverChange }) => {
  const segments = uri.replace(/\/$/, "").split("/");
  const name = decodeURIComponent(segments[segments.length - 1]);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const dragHandlers = onDrop && onDragOverChange ? {
    onDragEnter: (event: DragEvent<HTMLButtonElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setIsDropTarget(true);
      onDragOverChange(true);
    },
    onDragOver: (event: DragEvent<HTMLButtonElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
    },
    onDragLeave: () => {
      setIsDropTarget(false);
      onDragOverChange(false);
    },
    onDrop: (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDropTarget(false);
      onDragOverChange(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onDrop(files, uri, event.dataTransfer);
    },
  } : {};

  const buttonClassName = isDropTarget ? "folder-entry folder-entry--drop-target" : "folder-entry";
  const handleNavigateClick = () => onNavigate(uri);

  return (
    <button
      className={buttonClassName}
      onClick={handleNavigateClick}
      {...dragHandlers}
    >
      <span className="icon--folder" />
      <span className="folder-entry__name">{name}</span>
      <span className="folder-entry__arrow" />
    </button>
  );
};
