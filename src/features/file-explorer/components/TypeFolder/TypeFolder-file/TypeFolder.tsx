/**
 * Collapsible folder of one contact's browsable files, grouped by
 * schema.org type. Each row shows its own request outcome: pending while
 * awaiting, or denied with a re-request action. A granted file leaves the
 * browse list and surfaces in the shared view instead.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { getFileTypeInfo } from "@/infrastructure/validation/fileTypeRegistry";
import type { CatalogEntry } from "@/types";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import type { AccessApproval, AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { useFileAccessRequests } from "@/features/file-explorer/hooks/useAccessRequests";
import { useRequestStatus } from "@/shared/hooks/usePendingRequests";
import { RequestStatusPill } from "@/shared/components/RequestStatusPill";

/**
 * Props for the FileRow sub-component.
 *
 * @internal
 */
type FileRowProps = {
  entry: CatalogEntry;
  approval: AccessApproval | undefined;
  rejection: AccessRejection | undefined;
  failed: boolean;
  onRequest: (entry: CatalogEntry) => void;
  onRequestAgain: (entry: CatalogEntry, outcomeMessageUri: string | undefined) => void;
};

/**
 * A single file row inside the type folder body.
 *
 * @internal
 */
const FileRow: FunctionComponent<FileRowProps> = ({ entry, approval, rejection, failed, onRequest, onRequestAgain }) => {
  const [translate] = useTranslation();
  const status = useRequestStatus(toContainerUri(entry.uri), { approved: !!approval, denied: !!rejection });
  const outcomeMessageUri = approval?.messageUri ?? rejection?.messageUri;

  const label = entry.title || decodeURIComponent(
    entry.uri.replace(/\/index\.ttl$/, "").split("/").pop() ?? entry.uri
  );

  const settledRow = (settledStatus: "approved" | "denied", labelKey: string) => (
    <type-folder-file-actions>
      <RequestStatusPill
        status={settledStatus}
        label={translate(labelKey)}
        requestAgainLabel={translate("sharedWithMe.requestAgain")}
        onRequestAgain={() => onRequestAgain(entry, outcomeMessageUri)}
      />
    </type-folder-file-actions>
  );

  return (
    <type-folder-file-row>
      <span className="type-folder__file-name">{label}</span>
      {status === "approved" ? (
        settledRow("approved", "sharedWithMe.requestApproved")
      ) : status === "denied" ? (
        settledRow("denied", "sharedWithMe.requestDenied")
      ) : status === "pending" ? (
        <RequestStatusPill status="pending" label={translate("sharedWithMe.requestPending")} />
      ) : (
        <button className="btn btn--ghost btn--small" onClick={() => onRequest(entry)}>
          {translate(failed ? "sharedWithMe.requestError" : "sharedWithMe.requestFile")}
        </button>
      )}
    </type-folder-file-row>
  );
};

/**
 * Props for the TypeFolder component.
 */
type TypeFolderProps = {
  classUri: string;
  entries: CatalogEntry[];
  contactWebId: string;
  viewerWebId: string;
  rejections: Map<string, AccessRejection>;
  approvals: Map<string, AccessApproval>;
  onClearOutcome: (containerUri: string) => void;
};

/**
 * @public
 */
export const TypeFolder: FunctionComponent<TypeFolderProps> = ({
  classUri,
  entries,
  contactWebId,
  viewerWebId,
  rejections,
  approvals,
  onClearOutcome,
}) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const [isOpen, setIsOpen] = useState(false);

  const typeInfo = getFileTypeInfo(classUri);
  const { allPending, failedUris, handleRequestAll, handleRequestFile, handleRequestAgain } =
    useFileAccessRequests({ contactWebId, viewerWebId, solidFetch, entries, classUri, onClearOutcome });

  const bulkLabel = allPending
    ? translate("sharedWithMe.requestPending")
    : translate("sharedWithMe.requestAll");

  const itemsLabel = `${entries.length} ${translate(entries.length === 1 ? "sharedWithMe.item" : "sharedWithMe.items")}`;

  const handleToggle = () => setIsOpen((value) => !value);

  const fileRows = entries.map((entry) => {
    const entryContainerUri = toContainerUri(entry.uri);
    return (
      <FileRow
        key={entry.uri}
        entry={entry}
        approval={approvals.get(entryContainerUri)}
        rejection={rejections.get(entryContainerUri)}
        failed={failedUris.has(entryContainerUri)}
        onRequest={handleRequestFile}
        onRequestAgain={handleRequestAgain}
      />
    );
  });

  return (
    <type-folder>
      <type-folder-header>
        <button className="type-folder__toggle" data-open={isOpen} onClick={handleToggle}>
          <span className="type-folder__icon" />
          <span className="type-folder__label">{typeInfo.label}</span>
          <span className="type-folder__count">{itemsLabel}</span>
          <span className="type-folder__chevron" />
        </button>
        <button
          className="btn btn--ghost btn--small type-folder__request-all"
          onClick={handleRequestAll}
          disabled={allPending}
        >
          {bulkLabel}
        </button>
      </type-folder-header>

      {isOpen && <type-folder-body>{fileRows}</type-folder-body>}
    </type-folder>
  );
};
