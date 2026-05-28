/**
 * Shared view. Owns the active tab, the row selection, and the preview
 * dialog state, then composes the toolbar (or its selection variant)
 * with the body and the dialog.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';
import type { FunctionComponent } from 'react';
import { useSolidAuth } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { useContacts } from '@/features/file-explorer/hooks/useContacts';
import { useSharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { notifySharedCatalogsChanged } from '@/shared/hooks/useSharedCatalogVersion';
import { downloadResource } from '@/features/file-explorer/services/downloadResource';
import { FilePreviewDialog } from '@/features/onedrive-layout/components/FilePreviewDialog';
import { SharedToolbar, type SharedTabId } from './SharedToolbar';
import { SharedSelectionToolbar } from './SharedSelectionToolbar';
import { SharedBody } from './SharedBody';
import { useObservedSharedTypes } from './useObservedSharedTypes';
import { useSharedSelection } from './useSharedSelection';

export const SharedView: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const contacts = useContacts();
  const filters = useSharedFilters();
  const { chips, report, reset } = useObservedSharedTypes();
  const { showError } = useNotifications();
  const [tab, setTab] = useState<SharedTabId>('with-you');
  const { selected, select: handleSelect, clear: clearSelection } = useSharedSelection();
  const [previewOpen, setPreviewOpen] = useState(false);

  const ownerWebId = session.webId ?? '';
  const otherContacts = contacts.filter((webId: string) => webId !== ownerWebId);

  const handleTabChange = useCallback(
    (next: SharedTabId) => {
      setTab((current) => {
        if (current === next) return current;
        filters.resetClasses();
        reset();
        notifySharedCatalogsChanged();
        return next;
      });
    },
    [filters, reset],
  );

  const handleOpen = useCallback(() => {
    if (!selected) return;
    setPreviewOpen(true);
  }, [selected]);

  const handleDownload = useCallback(async () => {
    if (!selected) return;
    const result = await downloadResource(
      selected.binaryUri,
      selected.title,
      solidFetch,
    );
    if (!result.ok) {
      showError(
        `${translate('oneDriveLayout.toast.downloadFail', 'Download failed')}: ${result.reason}`,
      );
    }
  }, [selected, solidFetch, showError, translate]);

  return (
    <>
      {selected ? (
        <SharedSelectionToolbar
          count={1}
          onOpen={handleOpen}
          onDownload={handleDownload}
          onClear={clearSelection}
        />
      ) : (
        <SharedToolbar
          tab={tab}
          onTabChange={handleTabChange}
          chips={chips}
          filters={filters}
        />
      )}
      <SharedBody
        tab={tab}
        contacts={otherContacts}
        viewerWebId={ownerWebId}
        filters={filters}
        chips={chips}
        onObserve={report}
        selectedEntryUri={selected?.entryUri}
        onSelect={handleSelect}
      />
      {selected && (
        <FilePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          binaryUri={selected.binaryUri}
          title={selected.title}
          mediaType={selected.mediaType}
          solidFetch={solidFetch}
          onDownload={handleDownload}
        />
      )}
    </>
  );
};
