/**
 * File card component for displaying uploaded files with metadata.
 *
 * @packageDocumentation
 */

import { useMemo, useCallback, useState } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { CatalogEntryShShapeType } from "@/.ldo/catalogEntry.shapeTypes";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable, isReadable, isSolidContainer } from "@/infrastructure/solid/resourceGuards";
import { formatBytes } from "@/shared/utils/formatBytes";
import type { SolidLeaf } from "@ldo/connected-solid";
import { deleteResource } from "@/features/file-explorer/services/deleteResource";
import { getFileTypeInfo, resolveClass } from "@/infrastructure/validation/fileTypeRegistry";
import { SharePanel } from "@/features/file-explorer/components/SharePanel";
import { useFileSharing } from "@/features/file-explorer/hooks/useFileSharing";
import { useFilePreview } from "@/features/file-explorer/hooks/useFilePreview";
import { useNotifications } from "@/shared/contexts/NotificationContext";
import { DEFAULT_LOCALE, DATE_FORMAT_OPTIONS, DEFAULT_FILE_TYPE_URI, CONTENT_TYPES } from "@/config";
import type { SharedEntry } from "@/types";
import { FileMediaPreview } from "./FileMediaPreview";
import { FileCardInfoPanel } from "./FileCardInfoPanel";

function resolveFileClassUri(encodingFormat: string | null | undefined): string {
  const mimeType = encodingFormat ?? "";
  return mimeType ? resolveClass(mimeType) : DEFAULT_FILE_TYPE_URI;
}

/**
 * Props for the FileCard component.
 */
type FileCardProps = {
  containerUri: string;
  catalogUri: string;
  readOnly?: boolean;
};

/**
 * Renders a file card from index.ttl metadata.
 * Shows a preview when possible, with download, share, and delete options.
 *
 * @param props - Component props
 * @param props.containerUri - URI of the file container
 * @param props.catalogUri - URI of the DCAT catalog
 * @param props.readOnly - Whether to hide edit controls
 *
 * @public
 */
export const FileCard: FunctionComponent<FileCardProps> = ({ containerUri, catalogUri, readOnly = false }) => {
  const [translate] = useTranslation();
  const metadataUri = `${containerUri}index.ttl`;
  const { confirm } = useNotifications();

  const metadataResource = useResource(metadataUri);
  const containerResource = useResource(containerUri);
  const fileMeta = useSubject(CatalogEntryShShapeType, metadataUri);
  const publisherWebId = fileMeta?.publisher?.["@id"];
  const publisherProfile = useSubject(SolidProfileShapeType, publisherWebId);
  const publisherName = publisherProfile?.fn ?? publisherProfile?.name ?? publisherWebId;
  const { session, fetch: solidFetch } = useSolidAuth();
  const [showInfo, setShowInfo] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const ownerProfile = useSubject(SolidProfileShapeType, session.webId);
  const contacts = useMemo(
    () => ownerProfile?.knows?.toArray().map((c: { "@id": string }) => c["@id"]) ?? [],
    [ownerProfile]
  );

  const isShared = useFileSharing(containerUri, solidFetch);

  const binaryUri = useMemo(() => {
    if (isSolidContainer(containerResource)) {
      const leaf = containerResource.children().find(
        (child): child is SolidLeaf => !isSolidContainer(child) && !child.uri.endsWith("index.ttl")
      );
      if (leaf) return leaf.uri;
    }
    // schema:image is a real URL when present; schema:name is a human title
    // and produced 404s when used as a path segment. Don't guess from name.
    return fileMeta?.image?.["@id"];
  }, [containerResource, fileMeta]);

  const { previewUrl } = useFilePreview(binaryUri);

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm(translate("fileCard.deleteConfirm"));
    if (!confirmed) return;
    await deleteResource({
      containerUri,
      metadataUri,
      catalogUri,
      fetch: solidFetch,
    });
  }, [containerUri, metadataUri, catalogUri, solidFetch, translate, confirm]);

  const isMetaLoading =
    (isLoadable(metadataResource) && (metadataResource.isLoading() || metadataResource.isUnfetched())) ||
    (isReadable(metadataResource) && metadataResource.isReading());

  if (isMetaLoading) {
    return (
      <file-card className="file-card--loading">
        <div className="spinner spinner--medium" />
        {translate("fileCard.loading")}
      </file-card>
    );
  }

  if (readOnly && isLoadable(metadataResource) && metadataResource.isFetched() && !fileMeta?.uploadDate) {
    return null;
  }

  if (!fileMeta) {
    const folderName = decodeURIComponent(containerUri.replace(/\/$/, "").split("/").pop()!);
    const fallbackDownloadName = binaryUri?.split("/").pop();
    return (
      <file-card>
        <p className="file-card__name">{folderName}</p>
        {binaryUri && (
          <file-card-meta>
            <span className="file-card__date">{translate("fileCard.noMetadata")}</span>
            <a className="btn btn--ghost btn--small" href={binaryUri} download={fallbackDownloadName}>
              {translate("fileCard.download")}
            </a>
          </file-card-meta>
        )}
      </file-card>
    );
  }

  const handleToggleInfo = () => setShowInfo((current) => !current);
  const handleToggleShare = () => setShowShare((current) => !current);
  const downloadHref = previewUrl ?? binaryUri;
  const downloadFileName = fileMeta.name ?? binaryUri?.split("/").pop();

  const uploadedAt = fileMeta.uploadDate
    ? new Date(fileMeta.uploadDate).toLocaleDateString(DEFAULT_LOCALE, DATE_FORMAT_OPTIONS)
    : "";
  const dateModified = fileMeta.dateModified
    ? new Date(fileMeta.dateModified).toLocaleDateString(DEFAULT_LOCALE, DATE_FORMAT_OPTIONS)
    : "";

  const classUri = resolveFileClassUri(fileMeta.encodingFormat);
  const fileType = getFileTypeInfo(classUri);

  const infoButtonLabel = showInfo ? translate("fileCard.hideInfo") : translate("fileCard.info");
  const shareButtonLabel = showShare ? translate("fileCard.hideShare") : translate("fileCard.share");
  const sharedIconTitle = translate("fileCard.shared");
  const mimeType = fileMeta.encodingFormat ?? "";

  const sharedEntry: SharedEntry = {
    metadataUri,
    binaryUri: binaryUri ?? metadataUri,
    classUri,
    mediaType: fileMeta.encodingFormat ?? CONTENT_TYPES.OCTET_STREAM,
    byteSize: parseInt(fileMeta.contentSize ?? "0", 10),
    title: fileMeta.name ?? metadataUri.split("/").pop()!,
    description: fileMeta.description ?? "",
    modified: fileMeta.dateModified ?? fileMeta.uploadDate ?? new Date().toISOString(),
  };

  return (
    <file-card>
      {fileMeta.name && (
        <file-card-header>
          <p className="file-card__name">{fileMeta.name}</p>
          {isShared && (
            <span title={sharedIconTitle} className="file-card__shared" />
          )}
        </file-card-header>
      )}

      <file-card-body>
        {previewUrl && (
          <FileMediaPreview
            previewUrl={previewUrl}
            mimeType={mimeType}
            name={fileMeta.name}
          />
        )}

        {fileMeta.description && (
          <p className="file-card__description">{fileMeta.description}</p>
        )}

        <file-card-info>
          {fileMeta.encodingFormat && <span className="file-card__type">{fileMeta.encodingFormat}</span>}
          {fileMeta.contentSize && <span className="file-card__size">{formatBytes(fileMeta.contentSize)}</span>}
        </file-card-info>
      </file-card-body>

      <file-card-meta>
        <span className="file-card__date">{uploadedAt}</span>
        <file-card-actions>
          <button className="btn btn--ghost btn--small" onClick={handleToggleInfo}>
            {infoButtonLabel}
          </button>
          {!readOnly && (
            <button className="btn btn--ghost btn--small" onClick={handleToggleShare}>
              {shareButtonLabel}
            </button>
          )}
          {downloadHref && (
            <a
              className="btn btn--ghost btn--small"
              href={downloadHref}
              download={downloadFileName}
            >
              {translate("fileCard.download")}
            </a>
          )}
          {!readOnly && (
            <button className="btn btn--delete" onClick={handleDelete}>{translate("fileCard.delete")}</button>
          )}
        </file-card-actions>
      </file-card-meta>

      {!readOnly && showShare && (
        <SharePanel
          containerUri={containerUri}
          catalogUri={catalogUri}
          contacts={contacts}
          sharedEntry={sharedEntry}
        />
      )}

      {showInfo && (
        <FileCardInfoPanel
          name={fileMeta.name}
          description={fileMeta.description}
          encodingFormat={fileMeta.encodingFormat}
          contentSize={fileMeta.contentSize}
          isPartOf={fileMeta.isPartOf}
          uploadedAt={uploadedAt}
          dateModified={dateModified}
          fileType={fileType}
          publisherName={publisherName}
          publisherWebId={publisherWebId}
        />
      )}
    </file-card>
  );
};
