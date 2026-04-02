import { useState, useEffect, useMemo, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { parseCatalog, friendlyTypeInfo } from "./podCatalog";
import type { CatalogEntry, FetchFn } from "./podCatalog";
import { FileCard } from "./FileCard";
import { getAppContainerUri, getCandidateSharedCatalogUris } from "./shareCatalog";
import { discoverInboxUri, postFileAccessRequest, listRejectionNotifications, deleteAccessRequest } from "./inboxAccess";
import type { AccessRejection } from "./inboxAccess";
import { isLoadable } from "./pod";

function toContainerUri(instanceUri: string): string {
  return instanceUri.replace(/index\.ttl$/, "");
}

// Check whether the viewer can read a file container
async function hasAccess(containerUri: string, fetch: FetchFn): Promise<boolean> {
  try {
    const response = await fetch(containerUri, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

// Type Folder 
type TypeFolderProps = {
  classUri: string;
  entries: CatalogEntry[];
  contactWebId: string;
  viewerWebId: string;
  rejections: Map<string, AccessRejection>;
  onClearRejection: (containerUri: string) => void;
};

const TypeFolder: FunctionComponent<TypeFolderProps> = ({ classUri, entries, contactWebId, viewerWebId, rejections, onClearRejection }) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [fileStatuses, setFileStatuses] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});

  const typeInfo = friendlyTypeInfo(classUri);

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
    <div className="type-folder">
      <div className="type-folder__header">
        <button
          className="type-folder__toggle"
          onClick={() => setIsOpen((value) => !value)}
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
      </div>

      {isOpen && (
        <div className="type-folder__body">
          {entries.map((entry) => {
            const containerUri = toContainerUri(entry.uri);
            const rejection = rejections.get(containerUri);
            const fileStatus = fileStatuses[entry.uri] ?? "idle";
            const label = entry.title || decodeURIComponent(
              entry.uri.replace(/\/index\.ttl$/, "").split("/").pop() ?? entry.uri
            );
            return (
              <div key={entry.uri} className="type-folder__file-row">
                <span className="type-folder__file-name">{label}</span>
                {rejection ? (
                  <div className="type-folder__file-actions">
                    <span className="contact-row__denied">{translate("sharedWithMe.requestDenied")}</span>
                    <button
                      className="btn btn--ghost btn--small"
                      onClick={() => handleRequestAgain(entry, rejection)}
                    >
                      {translate("sharedWithMe.requestAgain")}
                    </button>
                  </div>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Contact Shared Files 

const ContactSharedFiles: FunctionComponent<{ contactWebId: string; viewerWebId: string }> = ({ contactWebId, viewerWebId }) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const profileDocUri = contactWebId.split("#")[0];
  const profileResource = useResource(profileDocUri);
  const profile = useSubject(SolidProfileShapeType, contactWebId);
  const isProfileLoading = isLoadable(profileResource) && profileResource.isLoading();

  const storageRoot =
    profile?.storage?.toArray()?.[0]?.["@id"] ??
    profileDocUri.replace(/\/profile\/card$/, "/");

  const catalogUris = useMemo(
    () => storageRoot ? getCandidateSharedCatalogUris(getAppContainerUri(storageRoot), viewerWebId) : [],
    [storageRoot, viewerWebId]
  );
  const mainCatalogUri = profile?.catalog?.["@id"] ?? (storageRoot ? `${storageRoot}catalog.ttl` : null);

  const [sharedEntries, setSharedEntries] = useState<CatalogEntry[]>([]);
  const [resolvedCatalogUri, setResolvedCatalogUri] = useState<string | null>(null);
  const [typeGroups, setTypeGroups] = useState<Map<string, CatalogEntry[]>>(new Map());
  const [catalogAccessible, setCatalogAccessible] = useState(false);
  const [fileRejections, setFileRejections] = useState<Map<string, AccessRejection>>(new Map());

  useEffect(() => {
    if (catalogUris.length === 0 && !mainCatalogUri) return;
    let cancelled = false;

    void (async () => {
      // 1. Try per-contact shared catalogs
      let foundShared: CatalogEntry[] = [];
      let foundCatalogUri: string | null = null;
      let perContactAccessible = false;

      for (const catalogUri of catalogUris) {
        try {
          const response = await solidFetch(catalogUri);
          if (!response.ok) continue;
          const text = await response.text();
          const parsed = parseCatalog(text, catalogUri);
          if (cancelled) return;
          perContactAccessible = true;
          if (parsed.length > 0) {
            foundShared = parsed;
            foundCatalogUri = catalogUri;
            break;
          }
        } catch {
          // try next
        }
      }

      if (cancelled) return;

      if (perContactAccessible) {
        setCatalogAccessible(true);
        setSharedEntries(foundShared);
        setResolvedCatalogUri(foundCatalogUri);

        // Fetch own inbox to find file level rejection notifications
        try {
          const ownInboxUri = await discoverInboxUri(viewerWebId, solidFetch);
          const rejectionList = await listRejectionNotifications(ownInboxUri, solidFetch);
          if (!cancelled) {
            const map = new Map(rejectionList.map((rejection) => [rejection.accessTo, rejection]));
            setFileRejections(map);
          }
        } catch {
          // inbox not accessible —> silently ignore
        }

        // 2. Fetch main catalog for browsable type folders
        if (mainCatalogUri) {
          try {
            const mainResponse = await solidFetch(mainCatalogUri);
            if (mainResponse.ok) {
              const mainText = await mainResponse.text();
              const allMainEntries = parseCatalog(mainText, mainCatalogUri);
              const sharedUris = new Set(foundShared.map((entry) => entry.uri));

              // 3. For entries NOT in per-contact catalog, check if viewer already
              //    has direct ACL access
              //    Those go to sharedEntries; truly unshared ones go to type folders
              const notYetShared = allMainEntries.filter((entry) => !sharedUris.has(entry.uri));

              const accessChecks = await Promise.all(
                notYetShared.map(async (entry) => ({
                  entry,
                  accessible: await hasAccess(toContainerUri(entry.uri), solidFetch),
                }))
              );

              if (cancelled) return;

              const recoveredShared: CatalogEntry[] = [];
              const browsable: CatalogEntry[] = [];

              for (const { entry, accessible } of accessChecks) {
                if (accessible) recoveredShared.push(entry);
                else browsable.push(entry);
              }

              // Merge recovered files into shared entries (use per-contact catalog URI as base)
              if (recoveredShared.length > 0) {
                setSharedEntries((prev) => [...prev, ...recoveredShared]);
              }

              // Group browsable entries by schema.org class
              const groups = new Map<string, CatalogEntry[]>();
              for (const entry of browsable) {
                const key = entry.conformsTo || "http://schema.org/DigitalDocument";
                const existing = groups.get(key) ?? [];
                groups.set(key, [...existing, entry]);
              }
              setTypeGroups(groups);
            }
          } catch {
            // main catalog not accessible —> silently ignore
          }
        }
        return;
      }

      // 4. Fall back: try main catalog directly
      if (mainCatalogUri) {
        try {
          const response = await solidFetch(mainCatalogUri);
          if (response.ok) {
            const text = await response.text();
            const parsed = parseCatalog(text, mainCatalogUri);
            if (!cancelled && parsed.length > 0) {
              setSharedEntries(parsed);
              setResolvedCatalogUri(mainCatalogUri);
              setCatalogAccessible(true);
              return;
            }
          }
        } catch {
          // not accessible
        }
      }

      if (!cancelled) {
        setSharedEntries([]);
        setTypeGroups(new Map());
        setResolvedCatalogUri(null);
        setCatalogAccessible(false);
      }
    })();

    return () => { cancelled = true; };
  }, [catalogUris, mainCatalogUri, solidFetch, viewerWebId]);

  const displayName =
    profile?.fn ??
    profile?.name ??
    contactWebId
      .replace(/#.*$/, "")
      .split("/")
      .filter(Boolean)
      .find((string) => string !== "profile" && string !== "card" && !string.startsWith("http")) ??
    contactWebId;

  if (!catalogAccessible && !isProfileLoading) return null;
  if (!catalogAccessible) return null;

  return (
    <>
      <p className="files-section-label">{translate("sharedWithMe.from", { name: displayName })}</p>

      {sharedEntries.length === 0 && typeGroups.size === 0 && (
        <p className="files-section-empty">{translate("sharedWithMe.noFilesYet")}</p>
      )}

      {sharedEntries.map((entry) => (
        <FileCard
          key={entry.uri}
          containerUri={toContainerUri(entry.uri)}
          catalogUri={resolvedCatalogUri ?? ""}
          readOnly
        />
      ))}

      {typeGroups.size > 0 && (
        <div className="type-folders">
          <p className="type-folders__heading">{translate("sharedWithMe.browseHeading")}</p>
          {[...typeGroups.entries()].map(([classUri, entries]) => (
            <TypeFolder
              key={classUri}
              classUri={classUri}
              entries={entries}
              contactWebId={contactWebId}
              viewerWebId={viewerWebId}
              rejections={fileRejections}
              onClearRejection={(containerUri) =>
                setFileRejections((prev) => {
                  const next = new Map(prev);
                  next.delete(containerUri);
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
    </>
  );
};

//  Shared With Me Section 

type SharedWithMeSectionProps = {
  contacts: string[];
  ownerWebId: string;
};

export const SharedWithMeSection: FunctionComponent<SharedWithMeSectionProps> = ({ contacts, ownerWebId }) => {
  const [translate] = useTranslation();
  const otherContacts = contacts.filter((contactWebId) => contactWebId !== ownerWebId);
  if (otherContacts.length === 0) return null;

  return (
    <section>
      <div className="files-section-header">
        <p className="files-section-label">{translate("sharedWithMe.heading")}</p>
      </div>
      {otherContacts.map((contactWebId) => (
        <ContactSharedFiles key={contactWebId} contactWebId={contactWebId} viewerWebId={ownerWebId} />
      ))}
    </section>
  );
};
