/**
 * File list component for the drive view.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { useResource } from "@ldo/solid-react";
import { FileCard } from "@/features/file-explorer/components/FileCard";
import { FolderEntry } from "@/features/file-explorer/components/FolderEntry";
import { isSolidContainer } from "@/infrastructure/solid/resourceGuards";
import { INDEX_FILE } from "@/config";
import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

/**
 * Props for the DriveFileList component.
 */
type DriveFileListProps = {
  folderEntries: SolidContainer[];
  leafEntries: SolidLeaf[];
  isInAppFolder: boolean;
  catalogUri: string;
  catalogContainerUris: Set<string>;
  onNavigate: (uri: string) => void;
  onDownload: (entry: SolidLeaf, fileName: string) => void;
  onFolderDrop?: (files: File[], targetUri: string, dataTransfer: DataTransfer | null) => void;
  onFolderDragOverChange?: (isOver: boolean) => void;
};

type FolderEntryRouterProps = {
  entry: SolidContainer;
  catalogUri: string;
  catalogContainerUris: Set<string>;
  onNavigate: (uri: string) => void;
  onFolderDrop?: (files: File[], targetUri: string, dataTransfer: DataTransfer | null) => void;
  onFolderDragOverChange?: (isOver: boolean) => void;
};

/**
 * Determines whether a folder entry is a file container (shows as FileCard)
 * or a bare folder (shows as FolderEntry).
 *
 * Uses the DCAT catalog as a fast path; falls back to structural detection
 * by checking for an index.ttl child inside the container.
 */
const FolderEntryRouter: FunctionComponent<FolderEntryRouterProps> = ({
  entry,
  catalogUri,
  catalogContainerUris,
  onNavigate,
  onFolderDrop,
  onFolderDragOverChange,
}) => {
  const resource = useResource(entry.uri);

  if (catalogContainerUris.has(entry.uri)) {
    return <FileCard containerUri={entry.uri} catalogUri={catalogUri} />;
  }

  if (resource && isSolidContainer(resource)) {
    const hasIndex = resource.children().some(
      (child) => !isSolidContainer(child) && child.uri === `${entry.uri}${INDEX_FILE}`
    );
    if (hasIndex) {
      return <FileCard containerUri={entry.uri} catalogUri={catalogUri} />;
    }
  }

  return (
    <FolderEntry
      uri={entry.uri}
      onNavigate={onNavigate}
      onDrop={onFolderDrop}
      onDragOverChange={onFolderDragOverChange}
    />
  );
};

type LeafFileEntryProps = {
  entry: SolidLeaf;
  onDownload: (entry: SolidLeaf, fileName: string) => void;
};

const LeafFileEntry: FunctionComponent<LeafFileEntryProps> = ({ entry, onDownload }) => {
  const [translate] = useTranslation();
  const fileName = decodeURIComponent(entry.uri.split("/").pop()!);
  const downloadLabel = translate("fileExplorer.download");
  const handleDownloadClick = () => onDownload(entry, fileName);
  return (
    <file-entry>
      <span className="file-entry__name">{fileName}</span>
      <button className="btn btn--ghost btn--small" onClick={handleDownloadClick}>
        {downloadLabel}
      </button>
    </file-entry>
  );
};

/**
 * Renders a list of folders and files in the current directory.
 * File containers (those with index.ttl or in the catalog) show as FileCards;
 * bare folders show as FolderEntry navigation items.
 *
 * @public
 */
export const DriveFileList: FunctionComponent<DriveFileListProps> = ({
  folderEntries,
  leafEntries,
  isInAppFolder,
  catalogUri,
  catalogContainerUris,
  onNavigate,
  onDownload,
  onFolderDrop,
  onFolderDragOverChange,
}) => {
  const [translate] = useTranslation();

  const isEmpty = folderEntries.length === 0 && leafEntries.length === 0;

  if (isEmpty) {
    const emptyStateMessage = isInAppFolder
      ? translate("fileExplorer.noFilesYet")
      : translate("fileExplorer.emptyFolder");
    return (
      <empty-state>
        <empty-state-icon>◌</empty-state-icon>
        <p>{emptyStateMessage}</p>
      </empty-state>
    );
  }

  return (
    <>
      {folderEntries.map((entry) => (
        <FolderEntryRouter
          key={entry.uri}
          entry={entry}
          catalogUri={catalogUri}
          catalogContainerUris={catalogContainerUris}
          onNavigate={onNavigate}
          onFolderDrop={onFolderDrop}
          onFolderDragOverChange={onFolderDragOverChange}
        />
      ))}
      {leafEntries.map((entry) => (
        <LeafFileEntry key={entry.uri} entry={entry} onDownload={onDownload} />
      ))}
    </>
  );
};
