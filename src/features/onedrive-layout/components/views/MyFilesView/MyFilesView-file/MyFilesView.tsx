/**
 * My Files view — the Pod browser surface inside the OneDrive-inspired
 * layout.
 *
 * Owns:
 *   - Folder navigation via {@link useNavigationHistory}, which wraps
 *     `useDriveInitialization` so browser back/forward and per-folder
 *     scroll position both work.
 *   - Drag-and-drop uploads at both the panel level and per folder,
 *     feeding the `useUploadQueue` hook that surfaces in-flight progress.
 *   - The local `prefilledFile` used by the upload form when the user
 *     drops a single file on the panel.
 *   - Branching between the browse table ({@link MyFilesTable}) and the
 *     search results table ({@link MyFilesSearchTable}).
 *
 * The page heading and contextual toolbar (Sort / Details) live in
 * {@link OneDriveLayout}'s page header — not in this component.
 *
 * @packageDocumentation
 */

import { Fragment, useCallback, useRef, useState } from 'react';
import type { DragEvent, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigationHistory } from '@/features/onedrive-layout/hooks/useNavigationHistory';
import { useResource, useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { resolveCatalogUri } from '@/infrastructure/solid/catalog';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { useCatalog } from '@/features/file-explorer/hooks/useCatalog';
import { useFileSearch } from '@/features/file-explorer/hooks/useFileSearch';
import { useUploadQueue } from '@/features/file-explorer/hooks/useUploadQueue';
import { DropZone } from '@/features/file-explorer/components/DropZone';
import { UploadTray } from '@/features/file-explorer/components/UploadTray';
import { NewFolderInput } from '@/features/file-explorer/components/NewFolderInput';
import { FileUpload } from '@/features/file-explorer/components/FileUpload';
import { hasUnsupportedFolderDrop } from '@/features/file-explorer/services/dragAndDrop';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { isSolidContainer } from '@/infrastructure/solid/resourceGuards';
import { isVisibleLeaf } from '@/features/file-explorer/services/fileFilter';
import type { SolidLeaf } from '@ldo/connected-solid';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { MyFilesTable } from './MyFilesTable';
import { MyFilesSearchTable } from './MyFilesSearchTable';
import { decodeUriTail } from '@/features/onedrive-layout/formatting';

interface MyFilesViewProps {
  searchValue: string;
  sort: SortState;
  showNewFolder: boolean;
  showUpload: boolean;
  onNewFolderDone: () => void;
  onUploadDone: () => void;
  onRequestUpload: () => void;
  selectedUri?: string;
  onSelect: (next: NonNullable<SelectedResource>) => void;
}

/**
 * Renders the My Files Pod browser surface. See the file-level docstring
 * for the responsibility breakdown.
 *
 * @public
 */
export const MyFilesView: FunctionComponent<MyFilesViewProps> = ({
  searchValue,
  sort,
  showNewFolder,
  showUpload,
  onNewFolderDone,
  onUploadDone,
  onRequestUpload,
  selectedUri,
  onSelect,
}) => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const {
    storageRootUri,
    currentUri,
    setCurrentUri,
    breadcrumbs,
    setBreadcrumbs,
    noStorageDetected,
    handleRetryStorage,
  } = useDriveInitialization();

  const {
    navigate: navigateToFolder,
    navigateToCrumb,
    attachScrollContainer,
  } = useNavigationHistory({
    currentUri,
    breadcrumbs,
    setCurrentUri,
    setBreadcrumbs,
  });

  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const { entries: catalogEntries, containerUris: catalogContainerUris } =
    useCatalog(catalogUri);
  const { debouncedQuery, results: searchResults } = useFileSearch(
    catalogEntries,
    searchValue,
  );
  const isSearching = debouncedQuery.length > 0;

  const profileHasCatalog = !!profile?.catalog?.['@id'];
  const safeCatalogUri = catalogUri ?? '';
  const {
    items: uploadItems,
    enqueueInstant,
    dismiss: dismissUpload,
    retry: retryUpload,
  } = useUploadQueue(safeCatalogUri, profileHasCatalog, catalogEntries);

  const { showError } = useNotifications();

  const [dragState, setDragState] = useState<
    'idle' | 'over-panel' | 'over-card'
  >('idle');
  const dragCounterRef = useRef(0);
  const isOverPanel = dragState === 'over-panel';
  const [prefilledFile, setPrefilledFile] = useState<File | undefined>();

  const currentContainer = useResource(currentUri);

  const currentFolderLabel =
    breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1].label
      : translate('fileExplorer.myDrive');

  // Form open state is owned by the parent; we just clear our local
  // prefilled file when the user navigates folders. We reset during
  // render via the "adjusting state on prop change" pattern documented
  // by React (https://react.dev/reference/react/useState#storing-information-from-previous-renders),
  // which avoids the cascading-render anti-pattern of resetting in
  // useEffect.
  const [previousUri, setPreviousUri] = useState(currentUri);
  if (previousUri !== currentUri) {
    setPreviousUri(currentUri);
    setPrefilledFile(undefined);
  }

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setDragState((current) =>
      current === 'over-card' ? 'over-card' : 'over-panel',
    );
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragState('idle');
  }, []);

  const dispatchDrop = useCallback(
    (files: File[], destinationUri: string, destinationLabel: string) => {
      if (files.length === 0) return;
      // Single-file drops on the current container open the upload form
      // prefilled with the file. Folder-row drops or multi-file drops go
      // straight to the queue.
      if (files.length === 1 && destinationUri === currentUri) {
        setPrefilledFile(files[0]);
        onRequestUpload();
        return;
      }
      enqueueInstant(files, destinationUri, destinationLabel);
    },
    [enqueueInstant, currentUri, onRequestUpload],
  );

  const handlePanelDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setDragState('idle');
      if (hasUnsupportedFolderDrop(event.dataTransfer)) {
        showError(translate('fileExplorer.unsupportedFolderDrop'));
        return;
      }
      if (!currentUri) return;
      const files = Array.from(event.dataTransfer.files);
      dispatchDrop(files, currentUri, currentFolderLabel);
    },
    [currentUri, currentFolderLabel, dispatchDrop, showError, translate],
  );

  const handleFolderDragOverChange = useCallback((isOver: boolean) => {
    setDragState(isOver ? 'over-card' : 'over-panel');
  }, []);

  const handleFolderDrop = useCallback(
    (
      files: File[],
      targetUri: string,
      dataTransfer: DataTransfer | null,
    ) => {
      dragCounterRef.current = 0;
      setDragState('idle');
      if (hasUnsupportedFolderDrop(dataTransfer)) {
        showError(translate('fileExplorer.unsupportedFolderDrop'));
        return;
      }
      dispatchDrop(files, targetUri, decodeUriTail(targetUri));
    },
    [dispatchDrop, showError, translate],
  );

  const handleUploadSuccess = useCallback(() => {
    setPrefilledFile(undefined);
    onUploadDone();
  }, [onUploadDone]);

  if (noStorageDetected) {
    return (
      <onedrive-view>
        <p>{translate('fileExplorer.noStorageFound')}</p>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={handleRetryStorage}
        >
          {translate('fileExplorer.retry')}
        </button>
      </onedrive-view>
    );
  }

  if (!currentContainer) {
    return (
      <onedrive-view>
        <div className="spinner" />
        <span>{translate('fileExplorer.connecting')}</span>
      </onedrive-view>
    );
  }

  const entries = isSolidContainer(currentContainer)
    ? currentContainer.children()
    : [];
  const folderEntries = entries.filter(isSolidContainer);
  const leafEntries = entries
    .filter((entry) => !isSolidContainer(entry))
    .filter(isVisibleLeaf) as SolidLeaf[];

  return (
    <onedrive-view
      ref={attachScrollContainer}
      data-view-id="my-files"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handlePanelDrop}
    >
      {isSearching ? (
        <MyFilesSearchTable
          query={debouncedQuery}
          results={searchResults}
          selectedUri={selectedUri}
          onSelect={onSelect}
        />
      ) : (
        <>
          {breadcrumbs.length > 1 && (
            <nav
              className="odl-breadcrumb"
              aria-label={translate('oneDriveLayout.breadcrumb', 'Breadcrumb')}
            >
              {breadcrumbs.map((crumb, index) => (
                <Fragment key={crumb.uri}>
                  {index > 0 && <span className="odl-breadcrumb__sep">/</span>}
                  <button
                    type="button"
                    className={`odl-breadcrumb__item${
                      index === breadcrumbs.length - 1
                        ? ' odl-breadcrumb__item--active'
                        : ''
                    }`}
                    onClick={() => navigateToCrumb(index, crumb.uri)}
                    disabled={index === breadcrumbs.length - 1}
                  >
                    {crumb.label}
                  </button>
                </Fragment>
              ))}
            </nav>
          )}
          <DropZone
            visible={isOverPanel}
            destinationLabel={currentFolderLabel}
          />
          {showUpload && isSolidContainer(currentContainer) && catalogUri && (
            <FileUpload
              mainContainer={currentContainer}
              catalogUri={catalogUri}
              profileHasCatalog={profileHasCatalog}
              onUploadSuccess={handleUploadSuccess}
              prefilledFile={prefilledFile}
            />
          )}
          {showNewFolder && isSolidContainer(currentContainer) && (
            <NewFolderInput
              parentContainer={currentContainer}
              onDone={onNewFolderDone}
            />
          )}
          <MyFilesTable
            folderEntries={folderEntries}
            leafEntries={leafEntries}
            catalogEntries={catalogEntries}
            catalogContainerUris={catalogContainerUris}
            sort={sort}
            selectedUri={selectedUri}
            onNavigate={navigateToFolder}
            onSelect={onSelect}
            onFolderDrop={handleFolderDrop}
            onFolderDragOverChange={handleFolderDragOverChange}
          />
        </>
      )}
      <UploadTray
        items={uploadItems}
        onDismiss={dismissUpload}
        onRetry={retryUpload}
      />
    </onedrive-view>
  );
};
