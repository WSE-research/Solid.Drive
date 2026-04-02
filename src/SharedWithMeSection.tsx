import { useState, useEffect, useMemo } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { parseCatalog } from "./podCatalog";
import type { CatalogEntry } from "./podCatalog";
import { FileCard } from "./FileCard";
import { getAppContainerUri, getCandidateSharedCatalogUris } from "./shareCatalog";
// Derives the file container URI from a catalog dataset URI (which points to index.ttl).
function toContainerUri(instanceUri: string): string {
  return instanceUri.replace(/index\.ttl$/, "");
}

const ContactSharedFiles: FunctionComponent<{ contactWebId: string; viewerWebId: string }> = ({ contactWebId, viewerWebId }) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const profileDocUri = contactWebId.split("#")[0];
  useResource(profileDocUri);
  const profile = useSubject(SolidProfileShapeType, contactWebId);

  const storageRoot =
    profile?.storage?.toArray()?.[0]?.["@id"] ??
    profileDocUri.replace(/\/profile\/card$/, "/");

  // Try the per-contact shared catalogs first, then fall back to the contact's
  // main catalog so older shares still show up
  const catalogUris = useMemo(
    () => storageRoot ? getCandidateSharedCatalogUris(getAppContainerUri(storageRoot), viewerWebId) : [],
    [storageRoot, viewerWebId]
  );
  const mainCatalogUri = profile?.catalog?.["@id"] ?? (storageRoot ? `${storageRoot}catalog.ttl` : null);

  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [resolvedCatalogUri, setResolvedCatalogUri] = useState<string | null>(null);

  useEffect(() => {
    if (catalogUris.length === 0 && !mainCatalogUri) return;
    let cancelled = false;

    void (async () => {
      for (const catalogUri of catalogUris) {
        try {
          const response = await solidFetch(catalogUri);
          if (!response.ok) continue;
          const text = await response.text();
          const parsedEntries = parseCatalog(text, catalogUri);
          if (cancelled) return;
          if (parsedEntries.length > 0) {
            setEntries(parsedEntries);
            setResolvedCatalogUri(catalogUri);
            return;
          }
        } catch {
          // Ignore and continue to the next candidate URI
        }
      }

      if (mainCatalogUri) {
        try {
          const response = await solidFetch(mainCatalogUri);
          if (response.ok) {
            const text = await response.text();
            const parsedEntries = parseCatalog(text, mainCatalogUri);
            if (!cancelled && parsedEntries.length > 0) {
              setEntries(parsedEntries);
              setResolvedCatalogUri(mainCatalogUri);
              return;
            }
          }
        } catch {
          // Ignore and fall through to the empty state.
        }
      }

      if (!cancelled) {
        setEntries([]);
        setResolvedCatalogUri(null);
      }
    })();

    return () => { cancelled = true; };
  }, [catalogUris, mainCatalogUri, solidFetch]);

  const displayName =
    profile?.fn ??
    profile?.name ??
    contactWebId
      .replace(/#.*$/, "")
      .split("/")
      .filter(Boolean)
      .find((segment) => segment !== "profile" && segment !== "card" && !segment.startsWith("http")) ??
    contactWebId;

  if (entries.length === 0) return null;

  return (
    <>
      <p className="files-section-label">{translate("sharedWithMe.from", { name: displayName })}</p>
      {entries.map((entry) => {
        const containerUri = toContainerUri(entry.uri);
        return (
          <FileCard
            key={entry.uri}
            containerUri={containerUri}
            catalogUri={resolvedCatalogUri ?? ""}
            readOnly
          />
        );
      })}
    </>
  );
};

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
      {otherContacts.map((webId) => (
        <ContactSharedFiles key={webId} contactWebId={webId} viewerWebId={ownerWebId} />
      ))}
    </section>
  );
};
