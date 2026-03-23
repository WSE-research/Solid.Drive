import { useEffect, useState, Fragment, useCallback, useRef } from "react";
import type { FunctionComponent } from "react";
import { FileUpload } from "./FileUpload";
import { FileCard } from "./FileCard";
import { FolderEntry } from "./FolderEntry";
import { useLdo, useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isSolidContainer, isLoadable, isReloadable } from "./pod";
import type { SolidContainer, SolidContainerUri, SolidLeaf } from "@ldo/connected-solid";

type DriveEntry = SolidContainer | SolidLeaf;
type Breadcrumb = { label: string; uri: SolidContainerUri };

interface FileExplorerProps {
  storageRetryDelayMs?: number;
}

const APP_CONTAINER_PATH = "my-solid-app/";
const DEFAULT_STORAGE_RETRY_DELAY_MS = 10_000;

export const FileExplorer: FunctionComponent<FileExplorerProps> = ({
  storageRetryDelayMs = DEFAULT_STORAGE_RETRY_DELAY_MS,
}) => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const webIdResource = useResource(session.webId);
  const { getResource } = useLdo();

  const initialized = useRef(false);
  const [appContainerUri, setAppContainerUri] = useState<SolidContainerUri>();
  const [currentUri, setCurrentUri] = useState<SolidContainerUri>();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isReloading, setIsReloading] = useState(false);
  const [noStorageDetected, setNoStorageDetected] = useState(false);

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
    const appUri = `${storageRoot}${APP_CONTAINER_PATH}` as SolidContainerUri;

    setCurrentUri(storageRoot);
    setAppContainerUri(appUri);
    setBreadcrumbs([{ label: translate("fileExplorer.myPod"), uri: storageRoot }]);
    initialized.current = true;

    const appContainer = getResource(appUri);
    if ("createIfAbsent" in appContainer) {
      void (async () => {
        await (appContainer as SolidContainer).createIfAbsent();
      })();
    }
  }, [profile, webIdResource, getResource, translate]);

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

  const currentContainer = useResource(currentUri);
  const appContainer = useResource(appContainerUri);

  const handleNavigate = useCallback((uri: string) => {
    const label = decodeURIComponent(uri.replace(/\/$/, "").split("/").pop() ?? uri);
    setBreadcrumbs((prev) => [...prev, { label, uri: uri as SolidContainerUri }]);
    setCurrentUri(uri as SolidContainerUri);
  }, []);

  const handleBreadcrumbClick = useCallback((index: number, uri: SolidContainerUri) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentUri(uri);
  }, []);

  const handleReload = useCallback(async () => {
    if (!currentContainer || !isReloadable(currentContainer)) return;
    setIsReloading(true);
    try {
      await currentContainer.reload();
    } finally {
      setIsReloading(false);
    }
  }, [currentContainer]);

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

  const isInAppFolder = currentUri === appContainerUri;
  const entries: DriveEntry[] = isSolidContainer(currentContainer)
    ? currentContainer.children()
    : [];
  const folderEntries = entries.filter(isSolidContainer) as SolidContainer[];
  const leafEntries = entries.filter((error) => !isSolidContainer(error)) as SolidLeaf[];

  return (
    <main>
      {isSolidContainer(appContainer) && (
        <FileUpload mainContainer={appContainer} />
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
                  <FileCard containerUri={entry.uri} />
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
                <a
                  href={entry.uri}
                  download={fileName}
                  className="btn btn--ghost btn--small"
                >
                  {translate("fileExplorer.download")}
                </a>
              </div>
            );
          })}
        </>
      )}
    </main>
  );
};
