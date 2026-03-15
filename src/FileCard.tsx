import { useMemo, useCallback, useState } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { CatalogEntryShShapeType } from "./.ldo/catalogEntry.shapeTypes";
import { isBinary, isReadable, isDeletable, isSolidContainer, formatBytes } from "./pod";
import type { SolidLeaf } from "@ldo/connected-solid";
import { FILE_TYPE_DEFS, removeFromCatalog } from "./catalog";

const FILE_TYPES = Object.fromEntries(FILE_TYPE_DEFS.map((contentType) => [contentType.id, { label: contentType.label, description: contentType.description }]));

type FileCardProps = {
  containerUri: string;
  storageRoot: string;
};

export const FileCard: FunctionComponent<FileCardProps> = ({ containerUri, storageRoot }) => {
  const [translate] = useTranslation();
  const metadataUri = `${containerUri}index.ttl`;

  const metadataResource = useResource(metadataUri);
  const containerResource = useResource(containerUri);
  const fileMeta = useSubject(CatalogEntryShShapeType, metadataUri);
  const { getResource } = useLdo();
  const { fetch: solidFetch } = useSolidAuth();
  const [showInfo, setShowInfo] = useState(false);

  /**
   * Resolves the URI of the binary file inside the container.
   * Prefers a live child resource, then falls back to the metadata name or image field.
   */
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

  /**
   * Creates a local object URL for image preview if the binary resource is available.
   * Returns undefined for non-binary or unloaded resources.
   */
  const previewUrl = useMemo(() => {
    if (isBinary(binaryResource) && binaryResource.isBinary()) {
      return URL.createObjectURL(binaryResource.getBlob());
    }
    return undefined;
  }, [binaryResource]);

  /** Asks the user to confirm, then deletes the entire file container from the pod. */
  const handleDelete = useCallback(async () => {
    if (!confirm(translate("fileCard.deleteConfirm"))) return;
    await removeFromCatalog(storageRoot, metadataUri, solidFetch).catch(() => {});
    const container = getResource(containerUri);
    if (isDeletable(container)) {
      await container.delete();
    }
  }, [containerUri, metadataUri, storageRoot, solidFetch, getResource, translate]);

  if (isReadable(metadataResource) && metadataResource.isReading()) {
    return (
      <div className="file-card file-card--loading">
        <div className="spinner spinner--medium" />
        {translate("fileCard.loading")}
      </div>
    );
  }

  if (!fileMeta) return null;

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
    if (mimeType.startsWith("image/")) return "ImageFile";
    if (mimeType.startsWith("video/")) return "VideoFile";
    if (mimeType.startsWith("audio/")) return "AudioFile";
    if (mimeType.startsWith("text/") || mimeType === "application/pdf") return "TextDocument";
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
        <div className="file-card__actions">
          <button
            className="btn btn--ghost btn--small"
            onClick={() => setShowInfo((currentValue) => !currentValue)}
          >
            {showInfo ? "Hide Info" : "Info"}
          </button>
          {(previewUrl ?? binaryUri) && (
            <a
              className="btn btn--ghost btn--small"
              href={previewUrl ?? binaryUri}
              download={fileMeta.name ?? binaryUri?.split("/").pop()}
            >
              {translate("fileCard.download")}
            </a>
          )}
          <button className="btn btn--delete" onClick={handleDelete}>{translate("fileCard.delete")}</button>
        </div>
      </div>

      {showInfo && (
        <div className="file-card__schema">
          <div className="file-card__schema-row">
            <span className="file-card__schema-label">File type</span>
            <span className="file-card__schema-value">
              <span className="file-card__tbox-badge">{fileType.label}</span>
              {fileType.description && <span className="file-card__tbox-note">{fileType.description}</span>}
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
          {fileMeta.publisher?.["@id"] && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">Uploaded by</span>
              <span className="file-card__schema-value file-card__schema-value--uri">{fileMeta.publisher["@id"]}</span>
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
