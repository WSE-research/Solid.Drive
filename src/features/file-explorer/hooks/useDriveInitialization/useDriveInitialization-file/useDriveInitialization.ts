/**
 * @packageDocumentation
 * Initializes the file explorer with Pod storage and app container.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSolidAuth, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import type { SolidContainerUri } from "@ldo/connected-solid";
import { STORAGE_RETRY_DELAY_MS } from "@/config";
import { usePodDiscovery } from "@/features/file-explorer/hooks/usePodDiscovery";
import type { Breadcrumb } from "@/features/file-explorer/hooks/useNavigation";
import {
  DRIVE_FOLDER_SEARCH_PARAM,
  buildDriveBreadcrumbs,
  decodeDriveFolderSearchParam,
  encodeDriveFolderSearchValue,
  isContainerUnderStorage,
} from "@/features/file-explorer/services/driveUrl";

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
 * Folder navigation is synced to the URL (`?folder=`) so back/forward and deep links work.
 *
 * @param storageRetryDelayMs - Delay before retrying storage discovery
 *
 * @public
 */
export function useDriveInitialization(
  storageRetryDelayMs: number = STORAGE_RETRY_DELAY_MS
): UseDriveInitializationReturn {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const folderParamRaw = searchParams.get(DRIVE_FOLDER_SEARCH_PARAM);
  const folderFromUrl = decodeDriveFolderSearchParam(folderParamRaw);

  const currentUri = useMemo(() => {
    if (
      folderFromUrl &&
      storageRootUri &&
      isContainerUnderStorage(folderFromUrl, storageRootUri)
    ) {
      return folderFromUrl;
    }
    return initialCurrentUri;
  }, [folderFromUrl, storageRootUri, initialCurrentUri]);

  const breadcrumbs = useMemo(() => {
    if (!currentUri || !storageRootUri) return [];
    return buildDriveBreadcrumbs(currentUri, storageRootUri, initialBreadcrumbLabel);
  }, [currentUri, storageRootUri, initialBreadcrumbLabel]);

  useEffect(() => {
    if (!initialCurrentUri || !storageRootUri) return;

    const isValid =
      !!(
        folderFromUrl &&
        storageRootUri &&
        isContainerUnderStorage(folderFromUrl, storageRootUri)
      );
    if (isValid) return;

    navigate(
      {
        search: `?${DRIVE_FOLDER_SEARCH_PARAM}=${encodeDriveFolderSearchValue(initialCurrentUri)}`,
      },
      { replace: true }
    );
  }, [folderFromUrl, storageRootUri, initialCurrentUri, navigate]);

  const navigateToFolder = useCallback(
    (uri: SolidContainerUri, opts: { replace: boolean }) => {
      navigate(
        {
          search: `?${DRIVE_FOLDER_SEARCH_PARAM}=${encodeDriveFolderSearchValue(uri)}`,
        },
        { replace: opts.replace }
      );
    },
    [navigate]
  );

  const setCurrentUri = useCallback(
    (uri: SolidContainerUri | undefined) => {
      if (!uri || !storageRootUri || !isContainerUnderStorage(uri, storageRootUri)) return;
      navigateToFolder(uri, { replace: false });
    },
    [navigateToFolder, storageRootUri]
  );

  const setBreadcrumbs = useCallback(
    (action: SetStateAction<Breadcrumb[]>) => {
      if (typeof action === "function") return;
      const last = action[action.length - 1];
      if (
        last?.uri &&
        storageRootUri &&
        isContainerUnderStorage(last.uri, storageRootUri)
      ) {
        navigateToFolder(last.uri as SolidContainerUri, { replace: true });
      }
    },
    [navigateToFolder, storageRootUri]
  );

  const handleNavigate = useCallback(
    (uri: string) => {
      const containerUri = uri as SolidContainerUri;
      if (!storageRootUri || !isContainerUnderStorage(containerUri, storageRootUri)) return;
      navigateToFolder(containerUri, { replace: false });
    },
    [navigateToFolder, storageRootUri]
  );

  const handleBreadcrumbClick = useCallback(
    (_index: number, uri: SolidContainerUri) => {
      if (!storageRootUri || !isContainerUnderStorage(uri, storageRootUri)) return;
      navigateToFolder(uri, { replace: false });
    },
    [navigateToFolder, storageRootUri]
  );

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
