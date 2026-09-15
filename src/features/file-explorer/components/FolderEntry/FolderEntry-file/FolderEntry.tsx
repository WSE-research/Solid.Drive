/**
 * Folder entry component for Pod navigation.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { DragEvent, FunctionComponent, MouseEvent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { deleteResource } from "@/features/file-explorer/services/deleteResource";
import { softDeleteFolder } from "@/features/file-explorer/services/softDeleteFolder";
import { useGuardedSoftDelete } from "@/features/file-explorer/hooks/useGuardedSoftDelete";

interface FolderEntryProps {
  uri: string;
  // Optional display name for the folder. If absent, uses the last segment of the URI.
  title?: string;
  // Catalog URI. When provided, a delete button is shown that removes the
  // folder, its contents, and its catalog entry.
  catalogUri?: string;
  // With catalogUri, these let delete move the folder to the Recycle bin.
  storageRootUri?: string;
  ownerWebId?: string;
  onNavigate: (uri: string) => void;
  onDrop?: (files: File[], targetUri: string, dataTransfer: DataTransfer | null) => void;
  onDragOverChange?: (isOver: boolean) => void;
}

/**
 * Renders a clickable folder row with optional drag-and-drop and soft delete.
 *
 * @public
 */
export const FolderEntry: FunctionComponent<FolderEntryProps> = ({
  uri,
  title,
  catalogUri,
  storageRootUri,
  ownerWebId,
  onNavigate,
  onDrop,
  onDragOverChange,
}) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const { runGuardedDelete } = useGuardedSoftDelete();
  const segments = uri.replace(/\/$/, "").split("/");
  const name = title ?? decodeURIComponent(segments[segments.length - 1]);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const dragHandlers = onDrop && onDragOverChange ? {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setIsDropTarget(true);
      onDragOverChange(true);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
    },
    onDragLeave: () => {
      setIsDropTarget(false);
      onDragOverChange(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDropTarget(false);
      onDragOverChange(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onDrop(files, uri, event.dataTransfer);
    },
  } : {};

  const rowClassName = isDropTarget ? "folder-entry folder-entry--drop-target" : "folder-entry";
  const handleNavigateClick = () => onNavigate(uri);

  // Soft delete needs storage root, WebID, and catalog.
  const canSoftDelete = !!catalogUri && !!storageRootUri && !!ownerWebId;

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!catalogUri) return;
    void runGuardedDelete({
      resourceUri: uri,
      confirmMessage: translate(canSoftDelete ? "fileExplorer.deleteFolderConfirm" : "fileExplorer.deleteFolderConfirmPermanent"),
      failedMessage: translate("fileExplorer.deleteFolderFail"),
      run: () =>
        canSoftDelete
          ? softDeleteFolder({
              containerUri: uri,
              storageRootUri: storageRootUri!,
              catalogUri,
              ownerWebId: ownerWebId!,
              fetch: solidFetch,
            })
          : deleteResource({ containerUri: uri, metadataUri: uri, catalogUri, fetch: solidFetch }),
    });
  };

  return (
    <folder-entry className={rowClassName} {...dragHandlers}>
      <button type="button" className="folder-entry__nav" onClick={handleNavigateClick}>
        <span className="icon--folder" />
        <span className="folder-entry__name">{name}</span>
        <span className="folder-entry__arrow" />
      </button>
      {catalogUri && (
        <button type="button" className="btn btn--delete" onClick={handleDeleteClick}>
          {translate("fileExplorer.deleteFolder")}
        </button>
      )}
    </folder-entry>
  );
};
