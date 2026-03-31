import { useState, useEffect, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useSubject, useResource } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isLoadable } from "./pod";
import { discoverInboxUri, listAccessRequests, deleteAccessRequest, postRejectionNotification } from "./inboxAccess";
import type { AccessRequest, FetchFn } from "./inboxAccess";
import { discoverAclUri, readAclAgents, writeResourceAcl, writeListOnlyAcl, writeAcl } from "./fileAccess";
import { getAppContainerUri, getSharedCatalogUri } from "./shareCatalog";

//TODO: Move shared RDF namespaces into a separate file
const EMPTY_CATALOG_TURTLE = `@prefix dcat: <http://www.w3.org/ns/dcat#> .

<> a dcat:Catalog .
`;

/** Create a shared catalog only if one does not already exist. */
async function ensureEmptySharedCatalog(uri: string, fetch: FetchFn): Promise<void> {
  const check = await fetch(uri, { method: "HEAD" });
  // Already exists; don't overwrite existing entries
  if (check.ok) return; 
  const response = await fetch(uri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: EMPTY_CATALOG_TURTLE,
  });
  if (!response.ok) {
    throw new Error(`Failed to create shared catalog at ${uri}: ${response.status} ${response.statusText}`);
  }
}

// Requester Row 
const RequesterRow: FunctionComponent<{ webId: string }> = ({ webId }) => {
  const [translate] = useTranslation();
  const contactResource = useResource(webId.split("#")[0]);
  const contact = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(contactResource) && contactResource.isLoading();

  const extractedUsername =
    webId.replace(/#.*$/, "").split("/").filter(Boolean)
      .find((string) => string !== "profile" && string !== "card" && !string.startsWith("http")) ?? webId;

  const displayName = contact?.name ?? contact?.fn ?? extractedUsername;
  const avatarUrl = contact?.img?.["@id"];
  const initial = displayName.slice(0, 1).toUpperCase() || "?";

  return (
    <div className="requests-panel__requester">
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName} className="avatar avatar--sm" />
      ) : (
        <div className="avatar avatar--sm avatar--placeholder">
          {isLoading ? <div className="spinner" /> : initial}
        </div>
      )}
      <span className="requests-panel__requester-name">
        {isLoading ? translate("requestsPanel.loading") : (displayName.length > 30 ? `${displayName.slice(0, 30)}…` : displayName)}
      </span>
    </div>
  );
};

// Request Item 
const RequestItem: FunctionComponent<{
  request: AccessRequest;
  onApprove: (r: AccessRequest) => Promise<void>;
  onDeny: (r: AccessRequest) => Promise<void>;
  isBusy: boolean;
}> = ({ request, onApprove, onDeny, isBusy }) => {
  const [translate] = useTranslation();

  const formattedDate = request.timestamp
    ? new Date(request.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const descriptionKey = request.requestType === "file"
    ? "requestsPanel.requestsFileAccess"
    : "requestsPanel.requestsAccess";

  const resourceLabel = request.requestType === "file"
    ? decodeURIComponent(request.accessTo.replace(/\/$/, "").split("/").pop() ?? request.accessTo)
    : undefined;

  return (
    <div className="requests-panel__item">
      <RequesterRow webId={request.requesterWebId} />
      <p className="requests-panel__description">
        {translate(descriptionKey, { resource: resourceLabel })}
      </p>
      {formattedDate && <p className="requests-panel__timestamp">{formattedDate}</p>}
      <div className="requests-panel__actions">
        <button className="btn btn--primary btn--small" onClick={() => onApprove(request)} disabled={isBusy}>
          {translate("requestsPanel.approve")}
        </button>
        <button className="btn btn--delete btn--small" onClick={() => onDeny(request)} disabled={isBusy}>
          {translate("requestsPanel.deny")}
        </button>
      </div>
    </div>
  );
};

// Requests Panel 
export type RequestsPanelProps = {
  ownerWebId: string;
  storageRoot: string;
 
 // The owner's main catalog URI
 // used to grant catalog-browse access on approval
  catalogUri: string;
  fetch: FetchFn;
  onCountChange: (count: number) => void;
};

export const RequestsPanel: FunctionComponent<RequestsPanelProps> = ({
  ownerWebId,
  storageRoot,
  catalogUri,
  fetch: solidFetch,
  onCountChange,
}) => {
  const [translate] = useTranslation();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMessageUri, setBusyMessageUri] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inboxUri = await discoverInboxUri(ownerWebId, solidFetch);
      const found = await listAccessRequests(inboxUri, solidFetch);
      setRequests(found);
      onCountChange(found.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onCountChange(0);
    } finally {
      setLoading(false);
    }
  }, [ownerWebId, solidFetch, onCountChange]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = useCallback(async (request: AccessRequest) => {
    setBusyMessageUri(request.messageUri);
    setError(null);
    try {
      const appContainerUri = getAppContainerUri(storageRoot);

      if (request.requestType === "catalog") {
        // 1. Create an empty per-contact shared catalog
        const sharedCatalogUri = getSharedCatalogUri(appContainerUri, request.requesterWebId);
        await ensureEmptySharedCatalog(sharedCatalogUri, solidFetch);

        // 2. Grant read access to the shared catalog file
        const sharedCatalogAclUri = await discoverAclUri(sharedCatalogUri, solidFetch);
        await writeResourceAcl(sharedCatalogAclUri, sharedCatalogUri, ownerWebId, [request.requesterWebId], solidFetch);

        // 3. Grant read access to the owner's main catalog so requester can browse available files
        const catalogAclUri = await discoverAclUri(catalogUri, solidFetch);
        const existingCatalogAgents = await readAclAgents(catalogAclUri, solidFetch);
        if (!existingCatalogAgents.includes(request.requesterWebId)) {
          await writeResourceAcl(catalogAclUri, catalogUri, ownerWebId, [...existingCatalogAgents, request.requesterWebId], solidFetch);
        }

        // 4. Grant list-only access to the app container
        const appAclUri = await discoverAclUri(appContainerUri, solidFetch);
        const existingAppAgents = await readAclAgents(appAclUri, solidFetch);
        if (!existingAppAgents.includes(request.requesterWebId)) {
          await writeListOnlyAcl(appAclUri, appContainerUri, ownerWebId, [...existingAppAgents, request.requesterWebId], solidFetch);
        }
      } else {
        // File request: grant read access to the specific file container
        const fileContainerUri = request.accessTo;
        const fileAclUri = await discoverAclUri(fileContainerUri, solidFetch);
        const existingFileAgents = await readAclAgents(fileAclUri, solidFetch);
        if (!existingFileAgents.includes(request.requesterWebId)) {
          await writeAcl(fileAclUri, fileContainerUri, ownerWebId, [...existingFileAgents, request.requesterWebId], solidFetch);
        }
      }

      // Delete the inbox message
      await deleteAccessRequest(request.messageUri, solidFetch);

      const updated = requests.filter((request) => request.messageUri !== request.messageUri);
      setRequests(updated);
      onCountChange(updated.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessageUri(null);
    }
  }, [ownerWebId, storageRoot, catalogUri, solidFetch, requests, onCountChange]);

  const handleDeny = useCallback(async (request: AccessRequest) => {
    setBusyMessageUri(request.messageUri);
    setError(null);
    try {
      // Notify the requester their request was denied
      try {
        const requesterInboxUri = await discoverInboxUri(request.requesterWebId, solidFetch);
        await postRejectionNotification(requesterInboxUri, request.accessTo, solidFetch);
      } catch {
        // Rejection notification is best-effort — don't block the deny action
      }
      await deleteAccessRequest(request.messageUri, solidFetch);
      const updated = requests.filter((requests) => requests.messageUri !== request.messageUri);
      setRequests(updated);
      onCountChange(updated.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessageUri(null);
    }
  }, [solidFetch, requests, onCountChange]);

  return (
    <div className="requests-panel">
      <button className="requests-panel__toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <span>{translate("requestsPanel.heading")}</span>
        {requests.length > 0 && <span className="requests-panel__badge">{requests.length}</span>}
        <span className="requests-panel__chevron">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="requests-panel__body">
          {loading && (
            <div className="requests-panel__loading">
              <div className="spinner spinner--small" />
              {translate("requestsPanel.loading")}
            </div>
          )}
          {error && <p className="requests-panel__error">{error}</p>}
          {!loading && !error && requests.length === 0 && (
            <p className="requests-panel__empty">{translate("requestsPanel.noRequests")}</p>
          )}
          {!loading && requests.map((request) => (
            <RequestItem
              key={request.messageUri}
              request={request}
              onApprove={handleApprove}
              onDeny={handleDeny}
              isBusy={busyMessageUri === request.messageUri}
            />
          ))}
          {!loading && (
            <button className="btn btn--ghost btn--small requests-panel__refresh" onClick={loadRequests} disabled={loading}>
              {translate("requestsPanel.refresh")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
