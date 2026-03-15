import { useState, useEffect } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { TBoxSection } from "./TBoxView";
import { ABoxEntry } from "./ABoxView";

type DataCatalogProps = {
  storageRoot: string;
  onClose: () => void;
};

export const DataCatalog: FunctionComponent<DataCatalogProps> = ({ storageRoot, onClose }) => {
  const { fetch: solidFetch } = useSolidAuth();
  const [instanceUris, setInstanceUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const root = storageRoot.endsWith("/") ? storageRoot : `${storageRoot}/`;
        const response = await solidFetch(`${root}catalog.ttl`);
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) { setInstanceUris([]); setLoading(false); }
            return;
          }
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        const matches = [...text.matchAll(/<([^>]+)>\s+a\s+dcat:Dataset/g)];
        if (!cancelled) setInstanceUris(matches.map((regexMatch) => regexMatch[1]));
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
              Uploaded files
              {!loading && !error && (
                <span className="catalog-section__count">
                  {instanceUris.length} {instanceUris.length === 1 ? "file" : "files"}
                </span>
              )}
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

            {!loading && !error && instanceUris.length === 0 && (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <div className="empty-state__icon">◌</div>
                <p>No files yet. Upload a file to see it here.</p>
              </div>
            )}

            {!loading && !error && instanceUris.map((uri) => (
              <ABoxEntry key={uri} uri={uri} />
            ))}
          </section>

        </div>
      </div>
    </div>
  );
};
