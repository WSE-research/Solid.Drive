/**
 * @packageDocumentation
 * Initializes the file explorer with Pod storage and app container.
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLdo, useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable, isReloadable } from "@/infrastructure/solid/resourceGuards";
import { getAppContainerUri } from "@/infrastructure/solid/sharedCatalog";
import type { SolidContainer, SolidContainerUri } from "@ldo/connected-solid";
import { STORAGE_RETRY_DELAY_MS } from "@/config";

export type Breadcrumb = { label: string; uri: SolidContainerUri };

type UseDriveInitializationReturn = {
  appContainerUri: SolidContainerUri | undefined;
  storageRootUri: string | undefined;
  currentUri: SolidContainerUri | undefined;
  setCurrentUri: (uri: SolidContainerUri) => void;
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: React.Dispatch<React.SetStateAction<Breadcrumb[]>>;
  noStorageDetected: boolean;
  handleRetryStorage: () => Promise<void>;
  contacts: string[];
};

/**
 * Sets up storage root, app container, and navigation state on login.
 *
 * @remarks
 * Discovers the user's pim:storage, creates the app container if needed,
 * and exposes navigation state for the file explorer.
 *
 * @param storageRetryDelayMs - Delay before retrying storage discovery
 *
 * @public
 */
export function useDriveInitialization(
  storageRetryDelayMs: number = STORAGE_RETRY_DELAY_MS
): UseDriveInitializationReturn {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const { getResource } = useLdo();

  const profile = useSubject(SolidProfileShapeType, session.webId);
  const webIdResource = useResource(session.webId);

  const initialized = useRef(false);
  const [appContainerUri, setAppContainerUri] = useState<SolidContainerUri>();
  const [storageRootUri, setStorageRootUri] = useState<string | undefined>();
  const [currentUri, setCurrentUri] = useState<SolidContainerUri>();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [noStorageDetected, setNoStorageDetected] = useState(false);

  const contacts = useMemo(
    () => profile?.knows?.toArray().map((c: { "@id": string }) => c["@id"]) ?? [],
    [profile]
  );

  useEffect(() => {
    if (initialized.current) return;
    const storageRootId = profile?.storage?.toArray()?.[0]?.["@id"];

    if (!storageRootId) {
      if (isLoadable(webIdResource) && !webIdResource.isLoading()) {
        setNoStorageDetected(true); // eslint-disable-line react-hooks/set-state-in-effect
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

  return {
    appContainerUri,
    storageRootUri,
    currentUri,
    setCurrentUri,
    breadcrumbs,
    setBreadcrumbs,
    noStorageDetected,
    handleRetryStorage,
    contacts,
  };
}
