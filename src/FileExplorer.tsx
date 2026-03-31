import { useEffect, useState, Fragment, useCallback, useRef, useMemo } from "react";
import type { FunctionComponent } from "react";
import { FileUpload } from "./FileUpload";
import { FolderEntry } from "./FolderEntry";
import { FileCard } from "./FileCard";
import { useLdo, useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isSolidContainer, isLoadable, isReloadable } from "./pod";
import { resolveCatalogUri } from "./useCatalogUri";
import { SharedWithMeSection } from "./SharedWithMeSection";
import { getAppContainerUri, isSharedCatalogFile } from "./shareCatalog";
import type { SolidContainer, SolidContainerUri, SolidLeaf } from "@ldo/connected-solid";

type DriveEntry = SolidContainer | SolidLeaf;
type Breadcrumb = { label: string; uri: SolidContainerUri };

interface FileExplorerProps {
  storageRetryDelayMs?: number;
}

const DEFAULT_STORAGE_RETRY_DELAY_MS = 10_000;
const SYSTEM_FILES = new Set(["catalog.ttl", "robots.txt", "README", ".acl", ".meta"]);

/**
 * Main file explorer — session, navigation, data loading,
 * folder browsing, uploads, and file display.
 */
export const FileExplorer: FunctionComponent<FileExplorerProps> = ({
  storageRetryDelayMs = DEFAULT_STORAGE_RETRY_DELAY_MS,
}) => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const webIdResource = useResource(session.webId);
  const { getResource } = useLdo();
  const initialized = useRef(false);
  const [appContainerUri, setAppContainerUri] = useState<SolidContainerUri>();
  const [storageRootUri, setStorageRootUri] = useState<string | undefined>();
  const [currentUri, setCurrentUri] = useState<SolidContainerUri>();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isReloading, setIsReloading] = useState(false);
  const [noStorageDetected, setNoStorageDetected] = useState(false);

  /**
   * Set up storage root, app folder, and initial navigation on first load.
   * Re-runs if the profile reloads and storage location changes.
   */
  useEffect(() => {
    if (initialized.current) return;
    const storageRootId = profile?.storage?.toArray()?.[0]?.["@id"];

    if (!storageRootId) {
      if (isLoadable(webIdResource) && !webIdResource.isLoading()) {
        setNoStorageDetected(true);
      }
      return;
    }

    setNoStorageDetected(false);
    const storageRoot = storageRootId as SolidContainerUri;
    const appUri = getAppContainerUri(storageRoot) as SolidContainerUri;

    setCurrentUri(storageRoot);
    setAppContainerUri(appUri);
    setStorageRootUri(storageRoot);
    setBreadcrumbs([{ label: translate("fileExplorer.myPod"), uri: storageRoot }]);
    initialized.current = true;

    void (async () => {
      const appContainerRes = getResource(appUri);
      if ("createIfAbsent" in appContainerRes) {
        await (appContainerRes as SolidContainer).createIfAbsent();
      }
    })();
  }, [profile, webIdResource, getResource, translate]);

  const currentContainer = useResource(currentUri);
  const appContainer = useResource(appContainerUri);

  /** Navigate into a subfolder and push it onto the breadcrumb trail. */
  const handleNavigate = useCallback((uri: string) => {
    const label = decodeURIComponent(uri.replace(/\/$/, "").split("/").pop() ?? uri);
    setBreadcrumbs((prev) => [...prev, { label, uri: uri as SolidContainerUri }]);
    setCurrentUri(uri as SolidContainerUri);
  }, []);

  /** Jump back to a breadcrumb at the given index and trim the trail. */
  const handleBreadcrumbClick = useCallback((index: number, uri: SolidContainerUri) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentUri(uri);
  }, []);

  /** Download a file via the session and trigger a browser save. */
  const handleDownload = useCallback(async (entry: SolidLeaf, fileName: string) => {
    try {
      const response = await solidFetch(entry.uri);
      if (!response.ok) { alert(`Download failed: ${response.status} ${response.statusText}`); return; }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`Download failed: ${(err as Error).message}`);
    }
  }, [solidFetch]);

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

  /** Reload the WebID profile and retry storage root discovery. */
  const handleRetryStorage = useCallback(async () => {
    if (!isReloadable(webIdResource)) return;
    setNoStorageDetected(false);
    initialized.current = false;
    await webIdResource.reload();
  }, [webIdResource]);

  useEffect(() => {
    if (!noStorageDetected) return;
    const timer = setTimeout(handleRetryStorage, storageRetryDelayMs);
    return () => clearTimeout(timer);
  }, [noStorageDetected, handleRetryStorage, storageRetryDelayMs]);

  const contacts = useMemo(
    () => profile?.knows?.toArray().map((contactEntry: { "@id": string }) => contactEntry["@id"]) ?? [],
    [profile]
  );

  if (!session.isLoggedIn) {
    return (
      <div className="drive-gate">
        <div className="drive-gate__icon">✦</div>
        <p>{translate("fileExplorer.loginPrompt")}</p>
      </div>
    );
  }

  if (noStorageDetected) {
    return (
      <div className="drive-error">
        <div className="drive-error__icon">⚠</div>
        <p>{translate("fileExplorer.noStorageFound")}</p>
        <button className="btn btn--ghost btn--small" onClick={handleRetryStorage}>
          {translate("fileExplorer.retry")}
        </button>
      </div>
    );
  }

  if (!currentContainer) {
    return (
      <div className="drive-loading">
        <div className="spinner" />
        <span>{translate("fileExplorer.connecting")}</span>
      </div>
    );
  }

  const catalogUri = resolveCatalogUri(profile, storageRootUri);

  const isInAppFolder = currentUri === appContainerUri;
  const entries: DriveEntry[] = isSolidContainer(currentContainer)
    ? currentContainer.children()
    : [];
  const folderEntries = entries.filter(isSolidContainer) as SolidContainer[];
  const leafEntries = (entries.filter((entry) => !isSolidContainer(entry)) as SolidLeaf[])
    .filter((entry) => {
      const fileName = decodeURIComponent(entry.uri.split("/").pop() ?? "");
      return !SYSTEM_FILES.has(fileName) && !isSharedCatalogFile(fileName);
    });

  return (
    <main>
      {isSolidContainer(appContainer) && catalogUri && (
        <FileUpload mainContainer={appContainer} catalogUri={catalogUri} profileHasCatalog={!!profile?.catalog?.["@id"]} />
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

      <div className="files-section-header">
        <p className="files-section-label">
          {isInAppFolder ? translate("fileExplorer.yourFiles") : translate("fileExplorer.podContents")}
        </p>
        <button
          className="btn btn--ghost btn--small"
          onClick={handleReload}
          disabled={isReloading}
        >
          {isReloading ? (
            <>
              <div className="spinner spinner--small" />
              {translate("fileExplorer.reloading")}
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {translate("fileExplorer.refresh")}
            </>
          )}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">◌</div>
          <p>{isInAppFolder ? translate("fileExplorer.noFilesYet") : translate("fileExplorer.emptyFolder")}</p>
        </div>
      ) : (
        <>
          {isInAppFolder
            ? folderEntries.map((entry) => (
                <Fragment key={entry.uri}>
                  <FileCard containerUri={entry.uri} catalogUri={catalogUri ?? ""} />
                </Fragment>
              ))
            : folderEntries.map((entry) => (
                <FolderEntry key={entry.uri} uri={entry.uri} onNavigate={handleNavigate} />
              ))
          }
          {leafEntries.map((entry) => {
            const fileName = decodeURIComponent(entry.uri.split("/").pop() ?? entry.uri);
            return (
              <div key={entry.uri} className="file-entry">
                <span className="file-entry__name">{fileName}</span>
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() => handleDownload(entry, fileName)}
                >
                  {translate("fileExplorer.download")}
                </button>
              </div>
            );
          })}
        </>
      )}
      <SharedWithMeSection contacts={contacts} ownerWebId={session.webId ?? ""} />
    </main>
  );
};
