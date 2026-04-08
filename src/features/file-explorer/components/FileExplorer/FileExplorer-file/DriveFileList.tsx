/**
 * File list component for the drive view.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { FileCard } from "@/features/file-explorer/components/FileCard";
import { FolderEntry } from "@/features/file-explorer/components/FolderEntry";
import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

/**
 * Props for the DriveFileList component.
 */
type DriveFileListProps = {
  folderEntries: SolidContainer[];
  leafEntries: SolidLeaf[];
  isInAppFolder: boolean;
  catalogUri: string;
  onNavigate: (uri: string) => void;
  onDownload: (entry: SolidLeaf, fileName: string) => void;
};

/**
 * Renders a list of folders and files in the current directory.
 * In the app folder, shows FileCards; otherwise shows FolderEntry navigation.
 *
 * @public
 */
export const DriveFileList: FunctionComponent<DriveFileListProps> = ({
  folderEntries,
  leafEntries,
  isInAppFolder,
  catalogUri,
  onNavigate,
  onDownload,
}) => {
  const [translate] = useTranslation();

  const isEmpty = folderEntries.length === 0 && leafEntries.length === 0;

  if (isEmpty) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">◌</div>
        <p>{isInAppFolder ? translate("fileExplorer.noFilesYet") : translate("fileExplorer.emptyFolder")}</p>
      </div>
    );
  }

  return (
    <>
      {isInAppFolder
        ? folderEntries.map((entry) => (
            <FileCard key={entry.uri} containerUri={entry.uri} catalogUri={catalogUri} />
          ))
        : folderEntries.map((entry) => (
            <FolderEntry key={entry.uri} uri={entry.uri} onNavigate={onNavigate} />
          ))}
      {leafEntries.map((entry) => {
        const fileName = decodeURIComponent(entry.uri.split("/").pop() ?? entry.uri);
        return (
          <div key={entry.uri} className="file-entry">
            <span className="file-entry__name">{fileName}</span>
            <button className="btn btn--ghost btn--small" onClick={() => onDownload(entry, fileName)}>
              {translate("fileExplorer.download")}
            </button>
          </div>
        );
      })}
    </>
  );
};
