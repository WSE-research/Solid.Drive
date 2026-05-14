/**
 * Top-level shell for the OneDrive-inspired layout.
 * Owns search, sort, selection, details-open, and create-menu state and
 * composes the NavRail, TopBar, ContextualToolbar, the active view, and
 * the DetailPanel. Also wires the selection-aware action handlers
 * (Share / Copy link / Download / Move to / Rename) and the ShareDialog.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { resolveCatalogUri } from '@/infrastructure/solid/catalog';
import { deleteResource } from '@/features/file-explorer/services/deleteResource';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { useCatalog } from '@/features/file-explorer/hooks/useCatalog';
import { useResourceDetails } from '@/features/onedrive-layout/hooks/useResourceDetails';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { copyToClipboard } from '@/shared/utils/copyToClipboard';
import { downloadResource } from '@/features/file-explorer/services/downloadResource';
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
import {
  containerUriFromCatalogUri,
  decodeUriTail,
} from '@/features/onedrive-layout/components/views/MyFilesView/MyFilesView-file/fileRowFormatting';
import { useViewParam, type ViewId } from '@/features/onedrive-layout/hooks/useViewParam';
import { useMyFilesSort } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { useSelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import { INDEX_FILE } from '@/config';
import type { CatalogEntry, SharedEntry } from '@/types';
import '@/features/onedrive-layout/OneDriveLayout.css';

const VIEW_TITLE_KEYS: Record<ViewId, string> = {
  recent: 'oneDriveLayout.viewTitle.recent',
  'my-files': 'oneDriveLayout.viewTitle.myFiles',
  shared: 'oneDriveLayout.viewTitle.shared',
  requests: 'oneDriveLayout.viewTitle.requests',
  people: 'oneDriveLayout.viewTitle.people',
};

/**
 * Builds a {@link SharedEntry} from the current selection plus its catalog
 * entry (if any). The metadata URI is derived from the container URI plus
 * the project's `INDEX_FILE`. Catalog-backed fields fall back to the
 * selection name and empty / zero values when no entry exists, which
 * keeps the share flow usable for folders and freshly-uploaded files
 * that haven't appeared in the catalog yet.
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
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const { storageRootUri, contacts } = useDriveInitialization();
  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const { entries: catalogEntries } = useCatalog(catalogUri);
  const { showSuccess, showError, confirm } = useNotifications();

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

  const requestNewFolder = () => {
    setView('my-files');
    setShowNewFolder(true);
  };
  const handleFilesPicked = (files: File[]) => {
    setView('my-files');
    setPickedFile(files[0]);
    setShowUpload(true);
  };
  const handleUploadDone = () => {
    setShowUpload(false);
    setPickedFile(undefined);
  };

  const handleShare = () => setShareOpen(true);

  const handleCopyLink = async () => {
    if (!selected) return;
    const ok = await copyToClipboard(selected.uri);
    if (ok) {
      showSuccess(
        translate(
          'oneDriveLayout.toast.linkCopied',
          'Link copied to clipboard',
        ),
      );
    } else {
      showError(
        translate('oneDriveLayout.toast.linkCopyFail', 'Could not copy link'),
      );
    }
  };

  const handleDownload = async () => {
    if (!selected || selected.kind !== 'file') return;
    const fileName = decodeUriTail(selected.uri) || selected.name;
    const result = await downloadResource(selected.uri, fileName, solidFetch);
    if (!result.ok) {
      showError(
        `${translate('oneDriveLayout.toast.downloadFail', 'Download failed')}: ${result.reason}`,
      );
    }
  };

  // Hard-deletes the selected resource: prompts the user, removes the
  // catalog entry (best-effort — folders typically aren't catalogued),
  // then deletes the container itself. Mirrors the existing FileCard
  // delete flow. On success the selection is cleared and the details
  // panel is closed.
  const handleDelete = async () => {
    if (!selected) return;
    const confirmed = await confirm(
      translate('oneDriveLayout.toast.deleteConfirm', {
        defaultValue: 'Delete "{{name}}"? This cannot be undone.',
        name: selected.name,
      }),
    );
    if (!confirmed) return;
    const catalogEntry = catalogByContainer.get(selected.uri);
    const result = await deleteResource({
      containerUri: selected.uri,
      metadataUri: catalogEntry?.uri,
      catalogUri: catalogUri ?? undefined,
      fetch: solidFetch,
    });
    if (!result.ok) {
      showError(
        `${translate('oneDriveLayout.toast.deleteFail', 'Delete failed')}: ${result.reason}`,
      );
      return;
    }
    showSuccess(
      translate('oneDriveLayout.toast.deleteSuccess', {
        defaultValue: '"{{name}}" deleted',
        name: selected.name,
      }),
    );
    clear();
    setDetailsOpen(false);
  };

  // Move To / Rename — UI present, behavior tracked in #36.
  const handleNoOp = () => {
    /* no-op stub */
  };

  // The panel's close button clears the selection AND closes the panel.
  const handleDetailsClose = () => {
    clear();
    setDetailsOpen(false);
  };

  // Selecting a row marks it active but does NOT open the details panel.
  // The user opens / closes the panel manually via the Details button —
  // when open, it reflects whichever row is currently selected (or shows
  // an empty hint when nothing is selected).
  // Clear selection when the active view changes, handled during render
  // to satisfy the project's react-hooks/set-state-in-effect rule.
  const [previousView, setPreviousView] = useState(view);
  if (previousView !== view) {
    setPreviousView(view);
    clear();
  }

  return (
    <onedrive-layout data-testid="onedrive-layout-root">
      <TopBar searchValue={searchValue} onSearchChange={setSearchValue} />
      <NavRail onNewFolder={requestNewFolder} onFilesPicked={handleFilesPicked} />
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
            onMoveTo={handleNoOp}
            onRename={handleNoOp}
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
          />
        )}
        {view === 'recent' && <RecentView />}
        {view === 'shared' && <SharedView />}
        {view === 'requests' && <RequestsView />}
        {view === 'people' && <PeopleView />}
      </main>
      <DetailPanel
        open={detailsOpen}
        selected={selected}
        details={details}
        onClose={handleDetailsClose}
      />
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
