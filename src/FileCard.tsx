import { useMemo, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useResource, useSubject } from "@ldo/solid-react";
import { PostShShapeType } from "./.ldo/post.shapeTypes";
import { isBinary, isReadable, isDeletable, isSolidContainer, formatBytes } from "./pod";
import type { SolidLeaf } from "@ldo/connected-solid";

type FileCardProps = {
  containerUri: string;
};

export const FileCard: FunctionComponent<FileCardProps> = ({ containerUri }) => {
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
    if (!confirm("Are you sure you want to delete this file?")) return;
    const container = getResource(containerUri);
    if (isDeletable(container)) {
      await container.delete();
    }
  }, [containerUri, getResource]);

  if (isReadable(metadataResource) && metadataResource.isReading()) {
    return (
      <div className="file-card" style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
        <div className="spinner" style={{ width: 14, height: 14 }} />
        Loading…
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
        <div style={{ display: "flex", gap: 8 }}>
          {!isImageFile && binaryUri && (
            <a
              className="btn btn-ghost"
              href={binaryUri}
              download={binaryUri.split("/").pop()}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              Download
            </a>
          )}
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
};
