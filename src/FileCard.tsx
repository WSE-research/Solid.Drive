import { useMemo, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useResource, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { PostShShapeType } from "./.ldo/post.shapeTypes";
import { isBinary, isReadable, isDeletable, isSolidContainer, formatBytes } from "./pod";
import type { SolidLeaf } from "@ldo/connected-solid";

type FileCardProps = {
  containerUri: string;
};

export const FileCard: FunctionComponent<FileCardProps> = ({ containerUri }) => {
  const [translate] = useTranslation();
  const metadataUri = `${containerUri}index.ttl`;

  const metadataResource = useResource(metadataUri);
  const containerResource = useResource(containerUri);
  const fileMeta = useSubject(PostShShapeType, metadataUri);
  const { getResource } = useLdo();

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

  const isImageFile = fileMeta?.encodingFormat?.startsWith("image/") ?? false;

  const handleDelete = useCallback(async () => {
    if (!confirm(translate("fileCard.deleteConfirm"))) return;
    const container = getResource(containerUri);
    if (isDeletable(container)) {
      await container.delete();
    }
  }, [containerUri, getResource, translate]);

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

  return (
    <div className="file-card">
      {fileMeta.name && <p className="file-card__name">{fileMeta.name}</p>}

      {isImageFile && previewUrl && (
        <img className="file-card__preview" src={previewUrl} alt={fileMeta.name ?? "Preview"} />
      )}

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
          {!isImageFile && binaryUri && (
            <a
              className="btn btn--ghost btn--small"
              href={binaryUri}
              download={binaryUri.split("/").pop()}
            >
              {translate("fileCard.download")}
            </a>
          )}
          <button className="btn btn--delete" onClick={handleDelete}>{translate("fileCard.delete")}</button>
        </div>
      </div>
    </div>
  );
};
