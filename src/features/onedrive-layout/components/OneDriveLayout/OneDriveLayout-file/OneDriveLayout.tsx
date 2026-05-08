/**
 * Top-level shell for the OneDrive-inspired layout. Owns search, sort,
 * selection, details-open, and create-menu state, composes the NavRail
 * + TopBar + active view + DetailPanel, and wires the selection-aware
 * action handlers and the ShareDialog.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * Builds a {@link SharedEntry} from the current selection. Catalog-backed
 * fields fall back to selection name and empty values so the share flow
 * stays usable for folders and freshly-uploaded files that haven't been
 * indexed yet.
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

  const { fetch: solidFetch, session } = useSolidAuth();
  void useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const { storageRootUri } = useDriveInitialization();
  const contacts = useContacts();
  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const { entries: catalogEntries } = useCatalog(catalogUri);

  const webId = session.webId ?? '';
  const profileName = getProfileDisplayName(profile, webId);
  const avatarSrc = profile?.img?.['@id'];

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
  const requestUpload = useCallback(() => {
    setView('my-files');
    setShowUpload(true);
  }, [setView]);

  const handleShare = useCallback(() => setShareOpen(true), []);

  const handleDetailsClose = useCallback(() => {
    clear();
    setDetailsOpen(false);
  }, [clear]);

  // Clear the active selection when the user navigates between views.
  // Skip the initial mount so the first render does not stomp a
  // selection set programmatically before the layout renders.
  const previousViewRef = useRef(view);
  useEffect(() => {
    if (previousViewRef.current === view) return;
    previousViewRef.current = view;
    clear();
  }, [view, clear]);

  // Shared, People, and Recent each render their own toolbar inline,
  // so we suppress the standard page-header for those views. Shared
  // additionally takes over the main grid slot.
  const isSharedView = view === 'shared';
  const isPeopleView = view === 'people';
  const isRecentView = view === 'recent';

  return (
    <onedrive-layout data-testid="onedrive-layout-root">
      <TopBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        webId={webId}
        profileName={profileName}
        avatarSrc={avatarSrc}
      />
      <NavRail onNewFolder={requestNewFolder} onUploadFiles={requestUpload} />
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
                onNewFolderDone={() => setShowNewFolder(false)}
                onUploadDone={() => setShowUpload(false)}
                onRequestUpload={() => setShowUpload(true)}
                selectedUri={selected?.uri}
                onSelect={select}
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
