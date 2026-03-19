import { useMemo, useCallback, useState } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { CatalogEntryShShapeType } from "./.ldo/catalogEntry.shapeTypes";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isBinary, isReadable, isDeletable, isSolidContainer, formatBytes } from "./pod";
import type { SolidLeaf } from "@ldo/connected-solid";
import { removeFromCatalog } from "./podCatalog";

const FILE_TYPES: Record<string, { label: string; description: string }> = {
  DigitalDocument: { label: "File", description: "Any general file" },
  ImageObject: { label: "Photo/Image", description: "Pictures/graphics" },
  VideoObject: { label: "Video", description: "Videos/movie clips" },
  AudioObject: { label: "Audio", description: "Music, podcasts, recordings" },
  TextDigitalDocument: { label: "Document", description: "PDFs, text, Word files" },
  SpreadsheetDigitalDocument: { label: "Spreadsheet", description: "Excel, CSV, etc." },
};

type FileCardProps = {
  containerUri: string;
  catalogUri: string;
};

export const FileCard: FunctionComponent<FileCardProps> = ({ containerUri, catalogUri }) => {
  const metadataUri = `${containerUri}index.ttl`;

  const metadataResource = useResource(metadataUri);
  const containerResource = useResource(containerUri);
  const fileMeta = useSubject(CatalogEntryShShapeType, metadataUri);
  const publisherWebId = fileMeta?.publisher?.["@id"];
  const publisherProfile = useSubject(SolidProfileShapeType, publisherWebId);
  const publisherName = publisherProfile?.fn ?? publisherProfile?.name ?? publisherWebId;
  const { getResource } = useLdo();
  const { fetch: solidFetch } = useSolidAuth();
  const [showInfo, setShowInfo] = useState(false);

  const binaryUri = useMemo(() => {
    if (isSolidContainer(containerResource)) {
      const leaf = containerResource.children().find(
        (child): child is SolidLeaf => !isSolidContainer(child) && !child.uri.endsWith("index.ttl")
      );
      if (leaf) return leaf.uri;
    }
    return fileMeta?.name ? `${containerUri}${fileMeta.name}` : fileMeta?.image?.["@id"];
  }, [containerResource, containerUri, fileMeta]);

  const binaryResource = useResource(binaryUri);

  const previewUrl = useMemo(() => {
    if (isBinary(binaryResource) && binaryResource.isBinary()) {
      return URL.createObjectURL(binaryResource.getBlob());
    }
    return undefined;
  }, [binaryResource]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    await removeFromCatalog(catalogUri, metadataUri, solidFetch).catch(() => {});
    const container = getResource(containerUri);
    if (isDeletable(container)) {
      await container.delete();
    }
  }, [containerUri, metadataUri, catalogUri, solidFetch, getResource]);

  if (isReadable(metadataResource) && metadataResource.isReading()) {
    return (
      <div className="file-card" style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
        <div className="spinner" style={{ width: 14, height: 14 }} />
        Loading…
      </div>
    );
  }

  if (!fileMeta) {
    const folderName = decodeURIComponent(containerUri.replace(/\/$/, "").split("/").pop() ?? containerUri);
    return (
      <div className="file-card">
        <p className="file-card__name">{folderName}</p>
        {binaryUri && (
          <div className="file-card__meta">
            <span className="file-card__date" style={{ color: "var(--text-muted)", fontSize: 12 }}>No metadata</span>
            <a
              className="btn btn-ghost"
              href={binaryUri}
              download={binaryUri.split("/").pop()}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              Download
            </a>
          </div>
        )}
      </div>
    );
  }

  const uploadedAt = fileMeta.uploadDate
    ? new Date(fileMeta.uploadDate).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const dateModified = fileMeta.dateModified
    ? new Date(fileMeta.dateModified).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const typeId = (() => {
    const fromType = fileMeta.type?.toArray().map((typeEntry: { "@id": string }) => typeEntry["@id"]).find((rawTypeId: string) => rawTypeId in FILE_TYPES);
    if (fromType) return fromType;
    const mimeType = fileMeta.encodingFormat ?? "";
    if (mimeType.startsWith("image/")) return "ImageObject";
    if (mimeType.startsWith("video/")) return "VideoObject";
    if (mimeType.startsWith("audio/")) return "AudioObject";
    if (mimeType.startsWith("text/") || mimeType === "application/pdf" || mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "TextDigitalDocument";
    if (mimeType === "application/vnd.ms-excel" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "text/csv") return "SpreadsheetDigitalDocument";
    return "DigitalDocument";
  })();
  const fileType = FILE_TYPES[typeId] ?? { label: typeId, description: "" };

  return (
    <div className="file-card">
      {fileMeta.name && <p className="file-card__name">{fileMeta.name}</p>}

      {previewUrl && (() => {
        const mimeType = fileMeta.encodingFormat ?? "";
        if (mimeType.startsWith("image/"))
          return <img className="file-card__preview" src={previewUrl} alt={fileMeta.name ?? "Preview"} />;
        if (mimeType.startsWith("video/"))
          return <video className="file-card__preview" src={previewUrl} controls />;
        if (mimeType.startsWith("audio/"))
          return <audio className="file-card__preview--audio" src={previewUrl} controls />;
        if (mimeType === "application/pdf" || mimeType.startsWith("text/"))
          return <iframe className="file-card__preview--doc" src={previewUrl} title={fileMeta.name ?? "Preview"} />;
        return null;
      })()}

      {fileMeta.description && (
        <p className="file-card__description">{fileMeta.description}</p>
      )}

      <div className="file-card__info">
        {fileMeta.encodingFormat && (
          <span className="file-card__type">{fileMeta.encodingFormat}</span>
        )}
        {fileMeta.contentSize && (
          <span className="file-card__size">{formatBytes(fileMeta.contentSize)}</span>
        )}
      </div>

      <div className="file-card__meta">
        <span className="file-card__date">{uploadedAt}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowInfo((currentValue) => !currentValue)}
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            {showInfo ? "Hide Info" : "Info"}
          </button>
          {(previewUrl ?? binaryUri) && (
            <a
              className="btn btn-ghost"
              href={previewUrl ?? binaryUri}
              download={fileMeta.name ?? binaryUri?.split("/").pop()}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              Download
            </a>
          )}
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>

      {showInfo && (
        <div className="file-card__schema">
          <div className="file-card__schema-row">
            <span className="file-card__schema-label">File type</span>
            <span className="file-card__schema-value">
              <span className="file-card__type-badge">{fileType.label}</span>
              {fileType.description && <span className="file-card__type-note">{fileType.description}</span>}
            </span>
          </div>

          {fileMeta.name && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Title</span>
              <span className="file-card__schema-value">{fileMeta.name}</span>
            </div>
          )}
          {fileMeta.description && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Description</span>
              <span className="file-card__schema-value">{fileMeta.description}</span>
            </div>
          )}
          {fileMeta.encodingFormat && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Format</span>
              <span className="file-card__schema-value">{fileMeta.encodingFormat}</span>
            </div>
          )}
          {fileMeta.contentSize && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Size</span>
              <span className="file-card__schema-value">{formatBytes(fileMeta.contentSize)}</span>
            </div>
          )}
          {uploadedAt && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Uploaded on</span>
              <span className="file-card__schema-value">{uploadedAt}</span>
            </div>
          )}
          {dateModified && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Last updated</span>
              <span className="file-card__schema-value">{dateModified}</span>
            </div>
          )}
          {publisherWebId && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Uploaded by</span>
              <span className="file-card__schema-value">{publisherName}</span>
            </div>
          )}
          {fileMeta.isPartOf?.["@id"] && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Part of</span>
              <span className="file-card__schema-value file-card__schema-value--uri">{fileMeta.isPartOf["@id"]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
