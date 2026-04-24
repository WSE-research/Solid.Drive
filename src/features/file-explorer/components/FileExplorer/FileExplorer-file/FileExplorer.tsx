/**
 * Main file explorer component for browsing and managing Pod files.
 *
 * @packageDocumentation
 */

import { useState, Fragment, useCallback, useEffect } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isSolidContainer, isReloadable } from "@/infrastructure/solid/resourceGuards";
import { resolveCatalogUri } from "@/infrastructure/solid/catalog";
import { SharedWithMeSection } from "@/features/file-explorer/components/SharedWithMeSection";
import { FileUpload } from "@/features/file-explorer/components/FileUpload";
import { isVisibleLeaf } from "@/features/file-explorer/services/fileFilter";
import { useNotifications } from "@/shared/contexts/NotificationContext";
import { STORAGE_RETRY_DELAY_MS } from "@/config";
import { useDriveInitialization } from "@/features/file-explorer/hooks/useDriveInitialization";
import { useCatalog } from "@/features/file-explorer/hooks/useCatalog";
import { useFileSearch } from "@/features/file-explorer/hooks/useFileSearch";
import { NewFolderInput } from "@/features/file-explorer/components/NewFolderInput";
import { SearchInput } from "@/features/file-explorer/components/SearchInput";
import { SearchResults } from "@/features/file-explorer/components/SearchResults";
import { DriveFileList } from "./DriveFileList";
import type { SolidLeaf } from "@ldo/connected-solid";

/**
 * Props for the FileExplorer component.
 */
interface FileExplorerProps {
  storageRetryDelayMs?: number;
}

/**
 * Main file explorer component.
 * Handles session state, navigation, data loading, folder browsing,
 * uploads, and file display. Provides pod-wide search that replaces the
 * folder listing with a flat results view while a query is active.
 * Shows shared files from contacts.
 *
 * @public
 */
export const FileExplorer: FunctionComponent<FileExplorerProps> = ({
  storageRetryDelayMs = STORAGE_RETRY_DELAY_MS,
}) => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const { showError } = useNotifications();
  const [isReloading, setIsReloading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const profile = useSubject(SolidProfileShapeType, session.webId);

  const {
    appContainerUri,
    storageRootUri,
    currentUri,
    breadcrumbs,
    noStorageDetected,
    handleRetryStorage,
    handleNavigate,
    handleBreadcrumbClick,
    contacts,
  } = useDriveInitialization(storageRetryDelayMs);

  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const { entries: catalogEntries, containerUris: catalogContainerUris } = useCatalog(catalogUri);
  const [searchQuery, setSearchQuery] = useState("");
  const { debouncedQuery, results: searchResults } = useFileSearch(catalogEntries, searchQuery);
  const isSearching = debouncedQuery.length > 0;

  const currentContainer = useResource(currentUri);

  /** Download a file via the session and trigger a browser save. */
  const handleDownload = useCallback(async (entry: SolidLeaf, fileName: string) => {
    try {
      const response = await solidFetch(entry.uri);
      if (!response.ok) {
        showError(`Download failed: ${response.status} ${response.statusText}`);
        return;
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showError(`Download failed: ${(err as Error).message}`);
    }
  }, [solidFetch, showError]);

  /** Reload the current folder from the pod. */
  const handleReload = useCallback(async () => {
    if (!currentContainer || !isReloadable(currentContainer)) return;
    setIsReloading(true);
    try {
      await currentContainer.reload();
    } finally {
      setIsReloading(false);
    }
  }, [currentContainer]);

  const handleNewFolderDone = useCallback(() => {
    setShowNewFolder(false);
    setShowAddMenu(false);
  }, []);

  const handleToggleAddMenu = useCallback(() => {
    setShowAddMenu((prev) => !prev);
  }, []);

  const handleSelectNewFolder = useCallback(() => {
    setShowNewFolder(true);
    setShowAddMenu(false);
  }, []);

  const handleSelectUploadFiles = useCallback(() => {
    setShowUpload(true);
    setShowAddMenu(false);
  }, []);

  const handleUploadDone = useCallback(() => {
    setShowUpload(false);
  }, []);

  useEffect(() => {
    if (!showAddMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAddMenu(false);
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("add-menu")) setShowAddMenu(false);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [showAddMenu]);

  useEffect(() => {
    setShowNewFolder(false);
    setShowUpload(false);
    setShowAddMenu(false);
  }, [currentUri]);

  if (!session.isLoggedIn) {
    return (
      <drive-gate>
        <drive-gate-icon>✦</drive-gate-icon>
        <p>{translate("fileExplorer.loginPrompt")}</p>
      </drive-gate>
    );
  }

  if (noStorageDetected) {
    return (
      <drive-error>
        <drive-error-icon>⚠</drive-error-icon>
        <p>{translate("fileExplorer.noStorageFound")}</p>
        <button className="btn btn--ghost btn--small" onClick={handleRetryStorage}>
          {translate("fileExplorer.retry")}
        </button>
      </drive-error>
    );
  }

  if (!currentContainer) {
    return (
      <drive-loading>
        <div className="spinner" />
        <span>{translate("fileExplorer.connecting")}</span>
      </drive-loading>
    );
  }

  const isInAppFolder = currentUri === appContainerUri;
  const entries = isSolidContainer(currentContainer) ? currentContainer.children() : [];
  const folderEntries = entries.filter(isSolidContainer);
  const leafEntries = entries.filter((entry) => !isSolidContainer(entry)).filter(isVisibleLeaf) as SolidLeaf[];

  return (
    <main>
      <SearchInput value={searchQuery} onChange={setSearchQuery} />
      {isSearching ? (
        <SearchResults
          query={debouncedQuery}
          results={searchResults}
          catalogUri={catalogUri ?? ""}
        />
      ) : (
        <>
          {showUpload && isSolidContainer(currentContainer) && catalogUri && (
            <FileUpload
              mainContainer={currentContainer}
              catalogUri={catalogUri}
              profileHasCatalog={!!profile?.catalog?.["@id"]}
              onUploadSuccess={handleUploadDone}
            />
          )}

          {breadcrumbs.length > 1 && (
            <nav className="breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <Fragment key={crumb.uri}>
                  {index > 0 && <span className="breadcrumb__sep">/</span>}
                  <button
                    className={`breadcrumb__item${index === breadcrumbs.length - 1 ? " breadcrumb__item--active" : ""}`}
                    onClick={() => handleBreadcrumbClick(index, crumb.uri)}
                    disabled={index === breadcrumbs.length - 1}
                  >
                    {crumb.label}
                  </button>
                </Fragment>
              ))}
            </nav>
          )}

          <files-section-header>
            <p className="files-section-label">
              {isInAppFolder ? translate("fileExplorer.yourFiles") : translate("fileExplorer.podContents")}
            </p>
            <div className="files-section-actions">
              <button className="btn btn--ghost btn--small" onClick={handleReload} disabled={isReloading}>
                {isReloading ? (
                  <>
                    <div className="spinner spinner--small" />
                    {translate("fileExplorer.reloading")}
                  </>
                ) : (
                  <>
                    <span className="icon--refresh" />
                    {translate("fileExplorer.refresh")}
                  </>
                )}
              </button>
              <add-menu>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={handleToggleAddMenu}
                  aria-haspopup="menu"
                  aria-expanded={showAddMenu}
                >
                  {translate("fileExplorer.add")} ▾
                </button>
                {showAddMenu && (
                  <add-menu-dropdown>
                    <button type="button" className="add-menu__item" onClick={handleSelectNewFolder}>
                      {translate("fileExplorer.newFolder")}
                    </button>
                    <button type="button" className="add-menu__item" onClick={handleSelectUploadFiles}>
                      {translate("fileExplorer.uploadFiles")}
                    </button>
                  </add-menu-dropdown>
                )}
              </add-menu>
            </div>
          </files-section-header>

          {showNewFolder && isSolidContainer(currentContainer) && (
            <NewFolderInput parentContainer={currentContainer} onDone={handleNewFolderDone} />
          )}

          <DriveFileList
            folderEntries={folderEntries}
            leafEntries={leafEntries}
            isInAppFolder={isInAppFolder}
            catalogUri={catalogUri ?? ""}
            catalogContainerUris={catalogContainerUris}
            onNavigate={handleNavigate}
            onDownload={handleDownload}
          />

          <SharedWithMeSection contacts={contacts} ownerWebId={session.webId ?? ""} />
        </>
      )}
    </main>
  );
};
