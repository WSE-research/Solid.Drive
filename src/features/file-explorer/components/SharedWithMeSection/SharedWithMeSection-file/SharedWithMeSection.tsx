/**
 * Shared files section showing files from contacts.
 *
 * @packageDocumentation
 */

import { useState, useEffect, useMemo } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { parseCatalog } from "@/infrastructure/solid/catalog";
import type { CatalogEntry } from "@/types";
import { FileCard } from "@/features/file-explorer/components/FileCard";
import { TypeFolder } from "@/features/file-explorer/components/TypeFolder";
import { getAppContainerUri, getCandidateSharedCatalogUris, toContainerUri, hasAccess } from "@/infrastructure/solid/sharedCatalog";
import { discoverInboxUri, listRejectionNotifications } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { isLoadable } from "@/infrastructure/solid/resourceGuards";
import { DEFAULT_FILE_TYPE_URI } from "@/config";

/**
 * Component displaying shared files from a single contact.
 *
 * @internal
 */
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
                const key = entry.conformsTo || DEFAULT_FILE_TYPE_URI;
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

  const handleClearRejection = (containerUri: string) => {
    setFileRejections((prev) => {
      const next = new Map(prev);
      next.delete(containerUri);
      return next;
    });
  };

  const displayName =
    profile?.fn ??
    profile?.name ??
    contactWebId
      .replace(/#.*$/, "")
      .split("/")
      .filter(Boolean)
      .find((pathSegment) => pathSegment !== "profile" && pathSegment !== "card" && !pathSegment.startsWith("http")) ??
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
        <type-folders>
          <p className="type-folders__heading">{translate("sharedWithMe.browseHeading")}</p>
          {[...typeGroups.entries()].map(([classUri, entries]) => (
            <TypeFolder
              key={classUri}
              classUri={classUri}
              entries={entries}
              contactWebId={contactWebId}
              viewerWebId={viewerWebId}
              rejections={fileRejections}
              onClearRejection={handleClearRejection}
            />
          ))}
        </type-folders>
      )}
    </>
  );
};

/**
 * Props for the SharedWithMeSection component.
 */
type SharedWithMeSectionProps = {
  contacts: string[];
  ownerWebId: string;
};

/**
 * Section displaying all files shared by contacts.
 * Reads per-contact shared catalogs and main catalogs with ACL checks.
 *
 * @public
 */
export const SharedWithMeSection: FunctionComponent<SharedWithMeSectionProps> = ({ contacts, ownerWebId }) => {
  const [translate] = useTranslation();
  const otherContacts = contacts.filter((contactWebId) => contactWebId !== ownerWebId);
  if (otherContacts.length === 0) return null;

  return (
    <section>
      <files-section-header>
        <p className="files-section-label">{translate("sharedWithMe.heading")}</p>
      </files-section-header>
      {otherContacts.map((contactWebId) => (
        <ContactSharedFiles key={contactWebId} contactWebId={contactWebId} viewerWebId={ownerWebId} />
      ))}
    </section>
  );
};
