import { useMemo, useCallback, useState, useEffect } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { CatalogEntryShShapeType } from "./.ldo/catalogEntry.shapeTypes";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isBinary, isReadable, isDeletable, isSolidContainer, formatBytes } from "./pod";
import type { SolidLeaf } from "@ldo/connected-solid";
import { removeFromCatalog, friendlyTypeInfo, resolveClass, isKnownType } from "./podCatalog";
import { SharePanel } from "./SharePanel";
import { discoverAclUri, readAclAgents } from "./fileAccess";

type FileCardProps = {
  containerUri: string;
  catalogUri: string;
};

/**
 * Displays a file based on metadata from index.ttl
 * Renders a preview when possible
 * Provides options to download or delete the file
 */
export const FileCard: FunctionComponent<FileCardProps> = ({ containerUri, catalogUri }) => {
  const [translate] = useTranslation();
  const metadataUri = `${containerUri}index.ttl`;

  const metadataResource = useResource(metadataUri);
  const containerResource = useResource(containerUri);
  const fileMeta = useSubject(CatalogEntryShShapeType, metadataUri);
  const publisherWebId = fileMeta?.publisher?.["@id"];
  const publisherProfile = useSubject(SolidProfileShapeType, publisherWebId);
  const publisherName = publisherProfile?.fn ?? publisherProfile?.name ?? publisherWebId;
  const { getResource } = useLdo();
  const { session, fetch: solidFetch } = useSolidAuth();
  const [showInfo, setShowInfo] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const ownerProfile = useSubject(SolidProfileShapeType, session.webId);
  const contacts = useMemo(
    () => ownerProfile?.knows?.toArray().map((knownContact: { "@id": string }) => knownContact["@id"]) ?? [],
    [ownerProfile]
  );

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

  /** Creates a blob URL for inline preview; revokes it on cleanup to prevent memory leaks. */
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!isBinary(binaryResource) || !binaryResource.isBinary()) return;
    const url = URL.createObjectURL(binaryResource.getBlob());
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl(undefined);
    };
  }, [binaryResource]);

  useEffect(() => {
    if (!containerResource) return;
    let cancelled = false;
    discoverAclUri(containerUri, solidFetch)
      .then((aclUri) => readAclAgents(aclUri, solidFetch))
      .then((sharedAgents) => { if (!cancelled) setIsShared(sharedAgents.length > 0); })
      .catch((err) => {
        console.warn("[FileCard] ACL discovery failed for", containerUri, err);
      });
    return () => { cancelled = true; };
  }, [containerUri, solidFetch, containerResource]);

  /** Asks the user to confirm, then deletes the entire file container from the pod. */
  const handleDelete = useCallback(async () => {
    if (!confirm(translate("fileCard.deleteConfirm"))) return;
    await removeFromCatalog(catalogUri, metadataUri, solidFetch).catch(() => {});
    const container = getResource(containerUri);
    if (isDeletable(container)) {
      await container.delete();
    }
  }, [containerUri, metadataUri, catalogUri, solidFetch, getResource, translate]);

  if (isReadable(metadataResource) && metadataResource.isReading()) {
    return (
      <div className="file-card file-card--loading">
        <div className="spinner spinner--medium" />
        {translate("fileCard.loading")}
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
            <span className="file-card__date">{translate("fileCard.noMetadata")}</span>
            <a
              className="btn btn--ghost btn--small"
              href={binaryUri}
              download={binaryUri.split("/").pop()}
            >
              {translate("fileCard.download")}
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

  // Format dates and infer file type from metadata or MIME to ensure consistent display when data is incomplete.
  const typeId = (() => {
    const fromType = fileMeta.type?.toArray().map((typeEntry: { "@id": string }) => typeEntry["@id"]).find(isKnownType);
    if (fromType) return fromType;
    const mimeType = fileMeta.encodingFormat ?? "";
    return mimeType ? resolveClass(mimeType) : "http://schema.org/DigitalDocument";
  })();
  const fileType = friendlyTypeInfo(typeId);

  return (
    <div className="file-card">
      {fileMeta.name && (
        <div className="file-card__header">
          <p className="file-card__name">{fileMeta.name}</p>
          {isShared && (
            <span title="Shared" className="file-card__shared">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </span>
          )}
        </div>
      )}

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
            {showInfo ? translate("fileCard.hideInfo") : translate("fileCard.info")}
          </button>
          <button
            className="btn btn--ghost btn--small"
            onClick={() => setShowShare((isVisible) => !isVisible)}
          >
            {showShare ? translate("fileCard.hideShare") : translate("fileCard.share")}
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

      {showShare && (
        <SharePanel containerUri={containerUri} contacts={contacts} />
      )}

      {showInfo && (
        <div className="file-card__schema">
          <div className="file-card__schema-row">
            <span className="file-card__schema-label">{translate("fileCard.fileType")}</span>
            <span className="file-card__schema-value">
              <span className="file-card__type-badge">{fileType.label}</span>
              {fileType.description && <span className="file-card__type-note">{fileType.description}</span>}
            </span>
          </div>

          {fileMeta.name && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.title")}</span>
              <span className="file-card__schema-value">{fileMeta.name}</span>
            </div>
          )}
          {fileMeta.description && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.description")}</span>
              <span className="file-card__schema-value">{fileMeta.description}</span>
            </div>
          )}
          {fileMeta.encodingFormat && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.format")}</span>
              <span className="file-card__schema-value">{fileMeta.encodingFormat}</span>
            </div>
          )}
          {fileMeta.contentSize && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.size")}</span>
              <span className="file-card__schema-value">{formatBytes(fileMeta.contentSize)}</span>
            </div>
          )}
          {uploadedAt && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.uploadedOn")}</span>
              <span className="file-card__schema-value">{uploadedAt}</span>
            </div>
          )}
          {dateModified && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.lastUpdated")}</span>
              <span className="file-card__schema-value">{dateModified}</span>
            </div>
          )}
          {publisherWebId && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.uploadedBy")}</span>
              <span className="file-card__schema-value">{publisherName}</span>
            </div>
          )}
          {fileMeta.isPartOf?.["@id"] && (
            <div className="file-card__schema-row">
              <span className="file-card__schema-label">{translate("fileCard.partOf")}</span>
              <span className="file-card__schema-value file-card__schema-value--uri">{fileMeta.isPartOf["@id"]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
