// ABox UI: renders a catalog entry from parsed catalog data 

import type { FunctionComponent } from "react";
import { formatBytes } from "./pod";
import { friendlyLabel } from "./catalog";
import type { CatalogEntry } from "./catalog";

export const ABoxEntry: FunctionComponent<{ entry: CatalogEntry }> = ({ entry }) => {
  const uploadedAt = entry.modified
    ? new Date(entry.modified).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";

  return (
    <div className="catalog-entry">
      <div className="catalog-entry__name">
        {entry.title || entry.uri.split("/").slice(-2, -1)[0] || entry.uri}
      </div>
      <div className="catalog-entry__meta">
        {entry.conformsTo && (
          <span className="file-card__type">{friendlyLabel(entry.conformsTo)}</span>
        )}
        {entry.byteSize > 0 && (
          <span className="file-card__size">{formatBytes(String(entry.byteSize))}</span>
        )}
        {uploadedAt && <span className="file-card__date">{uploadedAt}</span>}
      </div>
      {entry.description && (
        <div className="catalog-entry__desc">{entry.description}</div>
      )}
      {entry.mediaType && (
        <div className="catalog-entry__desc" style={{ color: "var(--text-muted)", fontSize: 11 }}>{entry.mediaType}</div>
      )}
      {entry.publisher && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          by {entry.publisher.split("/").filter(Boolean).find(segment => !segment.startsWith("http") && segment !== "profile" && segment !== "card") ?? entry.publisher}
        </div>
      )}
    </div>
  );
};
