/**
 * Type folder component for browsable file categories.
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
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { useFileAccessRequests } from "@/features/file-explorer/hooks/useAccessRequests";
import type { RequestStatus } from "@/features/file-explorer/hooks/useAccessRequests";

/**
 * Props for the FileRow sub-component.
 *
 * @internal
 */
type FileRowProps = {
  entry: CatalogEntry;
  rejection: AccessRejection | undefined;
  fileStatus: RequestStatus;
  bulkStatus: RequestStatus;
  onRequest: (entry: CatalogEntry) => void;
  onRequestAgain: (entry: CatalogEntry, rejection: AccessRejection) => void;
};

/**
 * A single file row inside the type folder body.
 *
 * @internal
 */
const FileRow: FunctionComponent<FileRowProps> = ({
  entry,
  rejection,
  fileStatus,
  bulkStatus,
  onRequest,
  onRequestAgain,
}) => {
  const [translate] = useTranslation();

  const label = entry.title || decodeURIComponent(
    entry.uri.replace(/\/index\.ttl$/, "").split("/").pop() ?? entry.uri
  );
  const isFileDisabled = fileStatus === "sending" || fileStatus === "sent" || bulkStatus === "sent";
  const fileButtonLabel =
    fileStatus === "sent" || bulkStatus === "sent"
      ? translate("sharedWithMe.requestSent")
      : fileStatus === "error"
      ? translate("sharedWithMe.requestError")
      : translate("sharedWithMe.requestFile");

  return (
    <type-folder-file-row>
      <span className="type-folder__file-name">{label}</span>
      {rejection ? (
        <type-folder-file-actions>
          <span className="contact-row__denied">{translate("sharedWithMe.requestDenied")}</span>
          <button
            className="btn btn--ghost btn--small"
            onClick={() => onRequestAgain(entry, rejection)}
          >
            {translate("sharedWithMe.requestAgain")}
          </button>
        </type-folder-file-actions>
      ) : (
        <button
          className="btn btn--ghost btn--small"
          onClick={() => onRequest(entry)}
          disabled={isFileDisabled}
        >
          {fileButtonLabel}
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
  onClearRejection: (containerUri: string) => void;
};

/**
 * Collapsible folder grouped by schema.org file type.
 * Displays files that haven't been explicitly shared yet,
 * with request access buttons for each file.
 *
 * @public
 */
export const TypeFolder: FunctionComponent<TypeFolderProps> = ({
  classUri,
  entries,
  contactWebId,
  viewerWebId,
  rejections,
  onClearRejection
}) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const [isOpen, setIsOpen] = useState(false);

  const typeInfo = getFileTypeInfo(classUri);

  const { bulkStatus, fileStatuses, handleRequestAll, handleRequestFile, handleRequestAgain } =
    useFileAccessRequests({ contactWebId, viewerWebId, solidFetch, entries, onClearRejection });

  const isBulkDisabled = bulkStatus === "sending" || bulkStatus === "sent";
  const bulkButtonLabel =
    bulkStatus === "sent"
      ? translate("sharedWithMe.requestSent")
      : bulkStatus === "error"
      ? translate("sharedWithMe.requestError")
      : translate("sharedWithMe.requestAll", { type: typeInfo.label });

  const handleToggle = () => setIsOpen((value) => !value);

  const fileRows = entries.map((entry) => {
    const entryContainerUri = toContainerUri(entry.uri);
    const entryRejection = rejections.get(entryContainerUri);
    const entryFileStatus = fileStatuses[entry.uri] ?? "idle";
    return (
      <FileRow
        key={entry.uri}
        entry={entry}
        rejection={entryRejection}
        fileStatus={entryFileStatus}
        bulkStatus={bulkStatus}
        onRequest={handleRequestFile}
        onRequestAgain={handleRequestAgain}
      />
    );
  });

  return (
    <type-folder>
      <type-folder-header>
        <button
          className="type-folder__toggle"
          data-open={isOpen}
          onClick={handleToggle}
        >
          <span className="type-folder__icon" />
          <span className="type-folder__label">{typeInfo.label}</span>
          <span className="type-folder__count">{entries.length}</span>
          <span className="type-folder__chevron" />
        </button>
        <button
          className="btn btn--ghost btn--small type-folder__request-all"
          onClick={handleRequestAll}
          disabled={isBulkDisabled}
        >
          {bulkButtonLabel}
        </button>
      </type-folder-header>

      {isOpen && (
        <type-folder-body>
          {fileRows}
        </type-folder-body>
      )}
    </type-folder>
  );
};
