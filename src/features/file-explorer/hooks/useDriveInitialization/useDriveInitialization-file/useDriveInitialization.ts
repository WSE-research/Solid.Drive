/**
 * @packageDocumentation
 * Initializes the file explorer with Pod storage and app container.
 */

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSolidAuth, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import type { SolidContainerUri } from "@ldo/connected-solid";
import { STORAGE_RETRY_DELAY_MS } from "@/config";
import { usePodDiscovery } from "@/features/file-explorer/hooks/usePodDiscovery";
import { useNavigation } from "@/features/file-explorer/hooks/useNavigation";
import type { Breadcrumb } from "@/features/file-explorer/hooks/useNavigation";

export type { Breadcrumb };

type UseDriveInitializationReturn = {
  appContainerUri: SolidContainerUri | undefined;
  storageRootUri: string | undefined;
  currentUri: SolidContainerUri | undefined;
  setCurrentUri: (uri: SolidContainerUri | undefined) => void;
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: Dispatch<SetStateAction<Breadcrumb[]>>;
  noStorageDetected: boolean;
  handleRetryStorage: () => Promise<void>;
  handleNavigate: (uri: string) => void;
  handleBreadcrumbClick: (index: number, uri: SolidContainerUri) => void;
  contacts: string[];
};

/**
 * Sets up storage root, app container, navigation state, and contacts on login.
 *
 * @remarks
 * Composes usePodDiscovery for storage setup and useNavigation for breadcrumb
 * state, adding contacts from the user's profile on top.
 *
 * @param storageRetryDelayMs - Delay before retrying storage discovery
 *
 * @public
 */
export function useDriveInitialization(
  storageRetryDelayMs: number = STORAGE_RETRY_DELAY_MS
): UseDriveInitializationReturn {
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const {
    appContainerUri,
    storageRootUri,
    noStorageDetected,
    handleRetryStorage,
    initialCurrentUri,
    initialBreadcrumbLabel,
  } = usePodDiscovery(storageRetryDelayMs);

  const {
    currentUri,
    setCurrentUri,
    breadcrumbs,
    setBreadcrumbs,
    handleNavigate,
    handleBreadcrumbClick,
  } = useNavigation();

  useEffect(() => {
    if (!initialCurrentUri) return;
    setCurrentUri(initialCurrentUri);
    setBreadcrumbs([{ label: initialBreadcrumbLabel, uri: initialCurrentUri }]);
  }, [initialCurrentUri, initialBreadcrumbLabel, setCurrentUri, setBreadcrumbs]);

  const [contacts, setContacts] = useState<string[]>([]);
  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContacts(profile.knows?.toArray().map((contact: { "@id": string }) => contact["@id"]) ?? []);
  }, [profile]);

  return {
    appContainerUri,
    storageRootUri,
    currentUri,
    setCurrentUri,
    breadcrumbs,
    setBreadcrumbs,
    noStorageDetected,
    handleRetryStorage,
    handleNavigate,
    handleBreadcrumbClick,
    contacts,
  };
}
