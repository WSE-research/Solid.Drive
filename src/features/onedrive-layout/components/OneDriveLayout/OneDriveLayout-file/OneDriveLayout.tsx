/**
 * Top-level shell for the OneDrive layout.
 *
 * Owns search, sort, selection, the details-panel toggle, and the
 * create-menu state. Composes the nav rail, top bar, contextual
 * toolbar, the active view, and the detail panel. Wires the
 * selection actions (share, copy link, download, delete, plus the
 * move and rename placeholders) and the share dialog.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResource, useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { resolveCatalogUri } from '@/infrastructure/solid/catalog';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { useContacts } from '@/features/file-explorer/hooks/useContacts';
import { useCatalog } from '@/features/file-explorer/hooks/useCatalog';
import { useResourceDetails } from '@/features/onedrive-layout/hooks/useResourceDetails';
import { useOneDriveActions } from '@/features/onedrive-layout/hooks/useOneDriveActions';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';
import { NavRail } from '@/features/onedrive-layout/components/NavRail';
import { TopBar } from '@/features/onedrive-layout/components/TopBar';
import { ContextualToolbar } from '@/features/onedrive-layout/components/ContextualToolbar';
import { SelectionActions } from '@/features/onedrive-layout/components/SelectionActions';
import { DetailPanel } from '@/features/onedrive-layout/components/DetailPanel';
import { ShareDialog } from '@/features/onedrive-layout/components/ShareDialog';
import { CatalogsPrefetcher } from '@/features/onedrive-layout/components/CatalogsPrefetcher';
import { useRefreshCatalogsOnFocus } from '@/shared/hooks/useRefreshCatalogsOnFocus';
import { CloseIcon } from '@/features/onedrive-layout/icons';
import { RecentView } from '@/features/onedrive-layout/components/views/RecentView';
import { MyFilesView } from '@/features/onedrive-layout/components/views/MyFilesView';
import { SharedView } from '@/features/onedrive-layout/components/views/SharedView';
import { RequestsView } from '@/features/onedrive-layout/components/views/RequestsView';
import { PeopleView } from '@/features/onedrive-layout/components/views/PeopleView';
import { containerUriFromCatalogUri } from '@/features/onedrive-layout/formatting';
import { useViewParam, type ViewId } from '@/features/onedrive-layout/hooks/useViewParam';
import { useMyFilesSort } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { useSelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import { INDEX_FILE } from '@/config';
import type { CatalogEntry, SharedEntry } from '@/types';
import '@/features/onedrive-layout/OneDriveLayout.css';

const NOOP = (): void => {};

const VIEW_TITLE_KEYS: Record<ViewId, string> = {
  recent: 'oneDriveLayout.viewTitle.recent',
  'my-files': 'oneDriveLayout.viewTitle.myFiles',
  shared: 'oneDriveLayout.viewTitle.shared',
  requests: 'oneDriveLayout.viewTitle.requests',
  people: 'oneDriveLayout.viewTitle.people',
};

/**
 * Builds a {@link SharedEntry} from the current selection and its catalog entry.
 * Catalog-backed fields fall back to the selection name and empty
 * values when no entry exists, which keeps the share flow usable for
 * folders and for freshly uploaded files not yet in the catalog.
 *
 * @internal
 */
const buildSharedEntry = (
  selection: NonNullable<SelectedResource>,
  entry: CatalogEntry | undefined,
): SharedEntry => ({
  metadataUri: `${selection.uri}${INDEX_FILE}`,
  binaryUri: entry?.accessURL ?? selection.uri,
  classUri: entry?.conformsTo ?? '',
  mediaType: entry?.mediaType ?? '',
  byteSize: entry?.byteSize ?? 0,
  title: entry?.title ?? selection.name,
  description: entry?.description ?? '',
  modified: entry?.modified ?? '',
});

/**
 * Renders the OneDrive-inspired application shell.
 *
 * @public
 */
export const OneDriveLayout: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [view, setView] = useViewParam();
  const [searchValue, setSearchValue] = useState('');
  const { sort, setSort } = useMyFilesSort();
  const { selected, select, clear } = useSelectedResource();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | undefined>();

  const { fetch: solidFetch, session } = useSolidAuth();
  void useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const { storageRootUri } = useDriveInitialization();
  const contacts = useContacts();
  // Bumped after a successful delete so the My Files view re-reads the
  // open folder in the background. Only the change matters.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const { entries: catalogEntries } = useCatalog(catalogUri);

  const webId = session.webId ?? '';
  const profileName = getProfileDisplayName(profile, webId);
  const avatarSrc = profile?.img?.['@id'];

  // Refresh the user's own catalog plus every cached shared catalog
  // the moment the tab regains focus, so changes made from another
  // tab or device land before the user navigates back to a view.
  useRefreshCatalogsOnFocus(catalogUri);

  const catalogByContainer = useMemo(() => {
    const map = new Map<string, CatalogEntry>();
    for (const entry of catalogEntries) {
      map.set(containerUriFromCatalogUri(entry.uri), entry);
    }
    return map;
  }, [catalogEntries]);

  const details = useResourceDetails({
    selection: selected,
    catalogByContainer,
  });
  const sharedEntry = useMemo(
    () =>
      selected ? buildSharedEntry(selected, catalogByContainer.get(selected.uri)) : null,
    [selected, catalogByContainer],
  );

  const handleAfterDelete = useCallback(() => {
    clear();
    setDetailsOpen(false);
    setRefreshNonce((current) => current + 1);
  }, [clear]);

  const { handleCopyLink, handleDownload, handleDelete } = useOneDriveActions({
    selected,
    catalogByContainer,
    catalogUri,
    solidFetch,
    onAfterDelete: handleAfterDelete,
  });

  const requestNewFolder = useCallback(() => {
    setView('my-files');
    setShowNewFolder(true);
  }, [setView]);
  const handleFilesPicked = useCallback(
    (files: File[]) => {
      setView('my-files');
      setPickedFile(files[0]);
      setShowUpload(true);
    },
    [setView],
  );
  const handleUploadDone = useCallback(() => {
    setShowUpload(false);
    setPickedFile(undefined);
    // Re-read the open folder so the newly uploaded container shows up
    // without the user having to refresh. The catalog re-fetch is handled
    // separately by the useCatalogVersion notification fired in useFileUpload.
    setRefreshNonce((current) => current + 1);
  }, []);

  const handleShare = useCallback(() => setShareOpen(true), []);

  const handleDetailsClose = useCallback(() => {
    clear();
    setDetailsOpen(false);
  }, [clear]);

  // Clearing the selection when the active view changes is handled during
  // render to satisfy the project's react-hooks/set-state-in-effect rule.
  const [previousView, setPreviousView] = useState(view);
  if (previousView !== view) {
    setPreviousView(view);
    clear();
  }

  // Shared, People, and Recent each render their own toolbar inline,
  // so we suppress the standard page-header for those views. Shared
  // additionally takes over the main grid slot.
  const isSharedView = view === 'shared';
  const isPeopleView = view === 'people';
  const isRecentView = view === 'recent';

  return (
    <onedrive-layout data-testid="onedrive-layout-root">
      <CatalogsPrefetcher contacts={contacts} viewerWebId={webId} />
      <TopBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        webId={webId}
        profileName={profileName}
        avatarSrc={avatarSrc}
      />
      <NavRail onNewFolder={requestNewFolder} onFilesPicked={handleFilesPicked} />
      {isSharedView ? (
        <SharedView />
      ) : (
        <>
          {!isPeopleView && !isRecentView && (
          <page-header
            data-selection-active={selected && view === 'my-files' ? 'true' : undefined}
          >
            {selected && view === 'my-files' ? (
              <SelectionActions
                selection={selected}
                onShare={handleShare}
                onCopyLink={handleCopyLink}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onMoveTo={NOOP}
                onRename={NOOP}
              />
            ) : (
              <h1 className="odl-page-title">{translate(VIEW_TITLE_KEYS[view])}</h1>
            )}
            <page-header-right>
              {selected && view === 'my-files' && (
                <button
                  type="button"
                  className="odl-selection-badge"
                  aria-label={translate(
                    'oneDriveLayout.action.clearSelection',
                    'Clear selection',
                  )}
                  onClick={clear}
                >
                  <CloseIcon aria-hidden focusable={false} />
                  <span>
                    {translate('oneDriveLayout.action.selectionCount', '{{count}} selected', {
                      count: 1,
                    })}
                  </span>
                </button>
              )}
              {view === 'my-files' && (
                <ContextualToolbar
                  sort={sort}
                  onSortChange={setSort}
                  detailsOpen={detailsOpen}
                  onToggleDetails={() => setDetailsOpen((open) => !open)}
                />
              )}
            </page-header-right>
          </page-header>
          )}
          <main data-view={view} className="odl-main">
            {view === 'my-files' && (
              <MyFilesView
                searchValue={searchValue}
                sort={sort}
                showNewFolder={showNewFolder}
                showUpload={showUpload}
                pickedFile={pickedFile}
                onNewFolderDone={() => setShowNewFolder(false)}
                onUploadDone={handleUploadDone}
                onRequestUpload={() => setShowUpload(true)}
                selectedUri={selected?.uri}
                onSelect={select}
                refreshNonce={refreshNonce}
              />
            )}
            {view === 'recent' && <RecentView />}
            {view === 'requests' && <RequestsView />}
            {view === 'people' && <PeopleView />}
          </main>
        </>
      )}
      {view === 'my-files' && (
        <DetailPanel
          open={detailsOpen}
          selected={selected}
          details={details}
          onClose={handleDetailsClose}
        />
      )}
      {selected && catalogUri && sharedEntry && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          containerUri={selected.uri}
          catalogUri={catalogUri}
          contacts={contacts}
          sharedEntry={sharedEntry}
        />
      )}
    </onedrive-layout>
  );
};
