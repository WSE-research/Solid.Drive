/**
 * Type folder component for browsable file categories.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { getFileTypeInfo } from "@/infrastructure/validation/fileTypeRegistry";
import type { CatalogEntry } from "@/types";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { discoverInboxUri, postFileAccessRequest, deleteAccessRequest } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";

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
  const [bulkStatus, setBulkStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [fileStatuses, setFileStatuses] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});

  const typeInfo = getFileTypeInfo(classUri);
  const handleToggle = () => setIsOpen((value) => !value);

  const handleRequestAll = useCallback(async () => {
    setBulkStatus("sending");
    try {
      const inboxUri = await discoverInboxUri(contactWebId, solidFetch);
      await Promise.all(
        entries.map((entry) =>
          postFileAccessRequest(inboxUri, viewerWebId, toContainerUri(entry.uri), solidFetch)
        )
      );
      setBulkStatus("sent");
    } catch {
      setBulkStatus("error");
    }
  }, [contactWebId, viewerWebId, entries, solidFetch]);

  const handleRequestFile = useCallback(async (entry: CatalogEntry) => {
    const containerUri = toContainerUri(entry.uri);
    setFileStatuses((prev) => ({ ...prev, [entry.uri]: "sending" }));
    try {
      const inboxUri = await discoverInboxUri(contactWebId, solidFetch);
      await postFileAccessRequest(inboxUri, viewerWebId, containerUri, solidFetch);
      setFileStatuses((prev) => ({ ...prev, [entry.uri]: "sent" }));
    } catch {
      setFileStatuses((prev) => ({ ...prev, [entry.uri]: "error" }));
    }
  }, [contactWebId, viewerWebId, solidFetch]);

  const handleRequestAgain = useCallback(async (entry: CatalogEntry, rejection: AccessRejection) => {
    const containerUri = toContainerUri(entry.uri);
    try {
      await deleteAccessRequest(rejection.messageUri, solidFetch);
    } catch {
      // cleanup
    }
    onClearRejection(containerUri);
    setFileStatuses((prev) => ({ ...prev, [entry.uri]: "idle" }));
    void handleRequestFile(entry);
  }, [solidFetch, onClearRejection, handleRequestFile]);

  return (
    <type-folder>
      <type-folder-header>
        <button
          className="type-folder__toggle"
          onClick={handleToggle}
        >
          <span className="type-folder__icon">{isOpen ? "📂" : "📁"}</span>
          <span className="type-folder__label">{typeInfo.label}</span>
          <span className="type-folder__count">{entries.length}</span>
          <span className="type-folder__chevron">{isOpen ? "▲" : "▼"}</span>
        </button>
        <button
          className="btn btn--ghost btn--small type-folder__request-all"
          onClick={handleRequestAll}
          disabled={bulkStatus === "sending" || bulkStatus === "sent"}
        >
          {bulkStatus === "sent"
            ? translate("sharedWithMe.requestSent")
            : bulkStatus === "error"
            ? translate("sharedWithMe.requestError")
            : translate("sharedWithMe.requestAll", { type: typeInfo.label })}
        </button>
      </type-folder-header>

      {isOpen && (
        <type-folder-body>
          {entries.map((entry) => {
            const containerUri = toContainerUri(entry.uri);
            const rejection = rejections.get(containerUri);
            const fileStatus = fileStatuses[entry.uri] ?? "idle";
            const label = entry.title || decodeURIComponent(
              entry.uri.replace(/\/index\.ttl$/, "").split("/").pop() ?? entry.uri
            );
            return (
              <type-folder-file-row key={entry.uri}>
                <span className="type-folder__file-name">{label}</span>
                {rejection ? (
                  <type-folder-file-actions>
                    <span className="contact-row__denied">{translate("sharedWithMe.requestDenied")}</span>
                    <button
                      className="btn btn--ghost btn--small"
                      onClick={() => handleRequestAgain(entry, rejection)}
                    >
                      {translate("sharedWithMe.requestAgain")}
                    </button>
                  </type-folder-file-actions>
                ) : (
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={() => handleRequestFile(entry)}
                    disabled={fileStatus === "sending" || fileStatus === "sent" || bulkStatus === "sent"}
                  >
                    {fileStatus === "sent" || bulkStatus === "sent"
                      ? translate("sharedWithMe.requestSent")
                      : fileStatus === "error"
                      ? translate("sharedWithMe.requestError")
                      : translate("sharedWithMe.requestFile")}
                  </button>
                )}
              </type-folder-file-row>
            );
          })}
        </type-folder-body>
      )}
    </type-folder>
  );
};
