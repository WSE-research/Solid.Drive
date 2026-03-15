// ─── ABox UI: displays individual catalog instance entries ────────────────────

import type { FunctionComponent } from "react";
import { useResource, useSubject } from "@ldo/solid-react";
import { CatalogEntryShShapeType } from "./.ldo/catalogEntry.shapeTypes";
import { isReadable, formatBytes } from "./pod";
import { FILE_TYPE_DEFS, friendlyLabel } from "./catalog";

export const ABoxEntry: FunctionComponent<{ uri: string }> = ({ uri }) => {
  const resource = useResource(uri);
  const entry = useSubject(CatalogEntryShShapeType, uri);

  if (isReadable(resource) && resource.isReading()) {
    return (
      <div className="catalog-entry catalog-entry--loading">
        <div className="spinner" style={{ width: 12, height: 12 }} />
        <span>Loading…</span>
      </div>
    );
  }

  if (!entry) return null;

  const uploadedAt = entry.uploadDate
    ? new Date(entry.uploadDate).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";

  const typeUri = (() => {
    const knownUris = FILE_TYPE_DEFS.map((contentType) => contentType.uri);
    const fromType = entry.type?.toArray().map((typeEntry: { "@id": string }) => typeEntry["@id"])
      .find((rawTypeId: string) => knownUris.includes(rawTypeId) || FILE_TYPE_DEFS.some((typeDef) => typeDef.label === rawTypeId));
    if (fromType) return fromType;
    const fmt = entry.encodingFormat ?? "";
    if (fmt.startsWith("image/")) return "https://example.com/app#ImageFile";
    if (fmt.startsWith("video/")) return "https://example.com/app#VideoFile";
    if (fmt.startsWith("audio/")) return "https://example.com/app#AudioFile";
    if (fmt.startsWith("text/") || fmt === "application/pdf") 
    return "https://example.com/app#TextDocument";
    return "http://schema.org/DigitalDocument";
  })();

  return (
    <div className="catalog-entry">
      <div className="catalog-entry__name">{entry.name ?? uri.split("/").slice(-2, -1)[0] ?? uri}</div>
      <div className="catalog-entry__meta">
        {typeUri && <span className="file-card__type">{friendlyLabel(typeUri)}</span>}
        {entry.contentSize && <span className="file-card__size">{formatBytes(entry.contentSize)}</span>}
        {uploadedAt && <span className="file-card__date">{uploadedAt}</span>}
      </div>
      {entry.description && (
        <div className="catalog-entry__desc">{entry.description}</div>
      )}
    </div>
  );
};
