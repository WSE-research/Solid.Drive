/**
 * @packageDocumentation
 * Discovers the user's Pod storage root and app container.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useLdo, useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable, isReloadable } from "@/infrastructure/solid/resourceGuards";
import { getAppContainerUri } from "@/infrastructure/solid/sharedCatalog";
import type { SolidContainer, SolidContainerUri } from "@ldo/connected-solid";

interface UsePodDiscoveryReturn {
  appContainerUri: SolidContainerUri | undefined;
  storageRootUri: string | undefined;
  noStorageDetected: boolean;
  handleRetryStorage: () => Promise<void>;
  initialCurrentUri: SolidContainerUri | undefined;
  initialBreadcrumbLabel: string;
}

/**
 * Finds pim:storage in the user's profile and prepares navigation defaults.
 *
 * @param storageRetryDelayMs - Delay before retrying if storage not found
 *
 * @public
 */
export function usePodDiscovery(storageRetryDelayMs: number): UsePodDiscoveryReturn {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const webIdResource = useResource(session.webId);
  const { getResource } = useLdo();
  const initialized = useRef(false);
  const [appContainerUri, setAppContainerUri] = useState<SolidContainerUri>();
  const [storageRootUri, setStorageRootUri] = useState<string | undefined>();
  const [noStorageDetected, setNoStorageDetected] = useState(false);
  const [initialCurrentUri, setInitialCurrentUri] = useState<SolidContainerUri>();
  const [initialBreadcrumbLabel, setInitialBreadcrumbLabel] = useState("");

  useEffect(() => {
    if (initialized.current) return;
    const storageRootId = profile?.storage?.toArray()?.[0]?.["@id"];

    if (!storageRootId) {
      if (isLoadable(webIdResource) && !webIdResource.isLoading()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNoStorageDetected(true);
      }
      return;
    }

    setNoStorageDetected(false);
    const storageRoot = storageRootId as SolidContainerUri;
    const appUri = getAppContainerUri(storageRoot) as SolidContainerUri;

    setInitialCurrentUri(storageRoot);
    setAppContainerUri(appUri);
    setStorageRootUri(storageRoot);
    setInitialBreadcrumbLabel(translate("fileExplorer.myPod"));
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
    noStorageDetected,
    handleRetryStorage,
    initialCurrentUri,
    initialBreadcrumbLabel,
  };
}
