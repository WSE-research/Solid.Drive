import { useState, useEffect } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { TBoxSection } from "./TBoxView";
import { ABoxEntry } from "./ABoxView";
import { parseCatalog } from "./catalog";
import type { CatalogEntry } from "./catalog";

type DataCatalogProps = {
  storageRoot: string;
  onClose: () => void;
};

export const DataCatalog: FunctionComponent<DataCatalogProps> = ({ storageRoot, onClose }) => {
  const { fetch: solidFetch } = useSolidAuth();
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const catalogRoot = storageRoot.endsWith("/") ? storageRoot : `${storageRoot}/`;
        const response = await solidFetch(`${catalogRoot}catalog.ttl`);
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) { setCatalogEntries([]); setLoading(false); }
            return;
          }
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const catalogUrl = `${catalogRoot}catalog.ttl`;
        const turtleText = await response.text();
        const entries = parseCatalog(turtleText, catalogUrl)
          .sort((firstEntry, secondEntry) => (secondEntry.modified ?? "").localeCompare(firstEntry.modified ?? ""))
          .slice(0, 2);
        if (!cancelled) setCatalogEntries(entries);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [storageRoot, solidFetch]);

  return (
    <div className="catalog-overlay" onClick={onClose}>
      <div className="catalog-modal" onClick={(clickEvent) => clickEvent.stopPropagation()}>

        <div className="catalog-modal__header">
          <span className="catalog-modal__title">File Catalog</span>
          <button className="catalog-modal__close btn btn-ghost" onClick={onClose}>×</button>
        </div>

        <div className="catalog-modal__body">

          <TBoxSection />

          <section className="catalog-section">
            <h3 className="catalog-section__heading">
              Recent uploads
            </h3>

            {loading && (
              <div className="catalog-loading">
                <div className="spinner" />
                <span>Loading…</span>
              </div>
            )}

            {error && (
              <div className="catalog-error">Could not load catalog: {error}</div>
            )}

            {!loading && !error && catalogEntries.length === 0 && (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <div className="empty-state__icon">◌</div>
                <p>No files yet. Upload a file to see it here.</p>
              </div>
            )}

            {!loading && !error && catalogEntries.map((entry) => (
              <ABoxEntry key={entry.uri} entry={entry} />
            ))}
          </section>

        </div>
      </div>
    </div>
  );
};
