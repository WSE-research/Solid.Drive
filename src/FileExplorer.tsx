import { useEffect, useState, Fragment, useCallback, useRef } from "react";
import type { FunctionComponent } from "react";
import { FileUpload } from "./FileUpload";
import { FolderEntry } from "./FolderEntry";
import { FileCard } from "./FileCard";
import { useLdo, useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isSolidContainer, isReloadable } from "./pod";
import { resolveCatalogUri } from "./useCatalogUri";
import type { SolidContainer, SolidContainerUri, SolidLeaf } from "@ldo/connected-solid";

type DriveEntry = SolidContainer | SolidLeaf;
type Breadcrumb = { label: string; uri: SolidContainerUri };

const APP_CONTAINER_PATH = "my-solid-app/";

const SYSTEM_FILES = new Set(["catalog.ttl", "robots.txt", "README", ".acl", ".meta"]);

export const FileExplorer: FunctionComponent = () => {
  const { session, fetch: solidFetch } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const { getResource } = useLdo();

  const initialized = useRef(false);
  const [appContainerUri, setAppContainerUri] = useState<SolidContainerUri>();
  const [storageRootUri, setStorageRootUri] = useState<string>("");
  const [currentUri, setCurrentUri] = useState<SolidContainerUri>();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    initialized.current = false;
    setAppContainerUri(undefined);
    setStorageRootUri("");
    setCurrentUri(undefined);
    setBreadcrumbs([]);
  }, [session.webId]);

  useEffect(() => {
    if (initialized.current) return;
    const storageRootId = profile?.storage?.toArray()?.[0]?.["@id"];
    if (!storageRootId) return;

    const storageRoot = storageRootId as SolidContainerUri;
    const appUri = `${storageRoot}${APP_CONTAINER_PATH}` as SolidContainerUri;

    setCurrentUri(storageRoot);
    setAppContainerUri(appUri);
    setStorageRootUri(storageRoot);
    setBreadcrumbs([{ label: "My Pod", uri: storageRoot }]);
    initialized.current = true;

    const appContainer = getResource(appUri);
    if ("createIfAbsent" in appContainer) {
      (appContainer as SolidContainer).createIfAbsent();
    }

  }, [profile, getResource, solidFetch]);

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
        <div className="empty-state__icon">✦</div>
        <p>Please log in to access your drive.</p>
      </div>
    );
  }

  if (!currentContainer) {
    return (
      <div className="drive-loading">
        <div className="spinner" />
        <span>Connecting to your Pod…</span>
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
      return !SYSTEM_FILES.has(fileName);
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p className="files-section-label" style={{ marginBottom: 0 }}>
          {isInAppFolder ? "Your Files" : "Pod Contents"}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {storageRootUri && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => setShowCatalog(true)}
            >
              File Catalog
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={handleReload}
            disabled={isReloading}
            style={{ fontSize: 12, padding: "6px 12px", opacity: isReloading ? 0.5 : 1 }}
          >
            {isReloading ? (
              <>
                <div className="spinner" style={{ width: 12, height: 12 }} />
                Reloading…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">◌</div>
          <p>{isInAppFolder ? "You pod is currently empty. Please upload your first one above." : "This folder is empty."}</p>
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
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={async () => {
                    try {
                      const response = await solidFetch(entry.uri);
                      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
                      const blob = await response.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const anchor = document.createElement("a");
                      anchor.href = blobUrl;
                      anchor.download = fileName;
                      anchor.click();
                      URL.revokeObjectURL(blobUrl);
                    } catch (error) {
                      alert(`Download failed: ${(error as Error).message}`);
                    }
                  }}
                >
                  Download
                </button>
              </div>
            );
          })}
        </>
      )}
    </main>
  );
};
