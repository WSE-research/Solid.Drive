import { useCallback, useRef, useState } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { CatalogEntryShShapeType } from "./.ldo/catalogEntry.shapeTypes";
import { isSolidLeaf } from "./pod";
import { resolveClass, appendToCatalog, linkCatalogToProfile } from "./podCatalog";
import type { ContainerCreationResult } from "./pod";
import type { SolidContainer, SolidContainerUri } from "@ldo/connected-solid";

type FileUploadProps = {
  mainContainer: SolidContainer;
  catalogUri: string;
  profileHasCatalog: boolean;
};

/**
 * Handles file uploads into the app container in the user's pod.
 *
 * The upload flow creates a dedicated container for the file, stores the binary,
 * writes RDF metadata to index.ttl, and then adds the new item to the catalog.
 * If a later step fails, it tries to delete any resources created earlier so the
 * pod does not end up with half-finished upload state.
 */
export const FileUpload: FunctionComponent<FileUploadProps> = ({ mainContainer, catalogUri, profileHasCatalog }) => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const { createData, commitData } = useLdo();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles form submission:
   * creates a named container on the pod, uploads the binary file,
   * then writes an index.ttl metadata resource with the title, description, and file info.
   */
  const handleSubmit = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.webId || !pendingFile) return;

    setIsUploading(true);
    let containerSlug: string | undefined;

    try {
      const classUri = resolveClass(pendingFile.type);

      // Use a safe folder name so the container URI is predictable
      containerSlug = pendingFile.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const containerUri = `${containerSlug}/` as SolidContainerUri;
      // Create a container per file (binary and index.ttl live together)
      const containerResult = await mainContainer.createChildAndOverwrite(containerUri) as ContainerCreationResult;
      if (containerResult.isError) return alert(containerResult.message);
      const fileContainer = containerResult.resource;
      
      // Upload the file with its MIME type so it is stored and served correctly.
      const uploadResult = await fileContainer.uploadChildAndOverwrite(
        pendingFile.name,
        pendingFile,
        pendingFile.type
      );

      if (uploadResult.isError) {
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        alert(uploadResult.message);
        return;
      }
      // index.ttl must exist to store RDF metadata
      const indexResource = fileContainer.child("index.ttl");
      if (!isSolidLeaf(indexResource)) {
        const binaryUri = `${mainContainer.uri}${containerSlug}/${pendingFile.name}`;
        await solidFetch(binaryUri, { method: "DELETE" }).catch(() => {});
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        alert("Could not create metadata resource.");
        return;
      }

      const metadata = createData(CatalogEntryShShapeType, indexResource.uri, indexResource);
      // Extract schema type from full URI and add to metadata
      const typeLocalName = (classUri.split(/[#/]/).pop() ?? "DigitalDocument") as
        "DigitalDocument" | "ImageObject" | "VideoObject" | "AudioObject" | "TextDigitalDocument" | "SpreadsheetDigitalDocument";
      
      metadata.type.add({ "@id": typeLocalName });
      metadata.name = title.trim() || pendingFile.name;
      metadata.encodingFormat = pendingFile.type || undefined;
      metadata.contentSize = pendingFile.size.toString();
      metadata.uploadDate = new Date().toISOString();
      metadata.publisher = { "@id": session.webId };
      if (description.trim()) metadata.description = description.trim();
      
      // Basic validation before writing RDF to the pod 
      if (!metadata.uploadDate) return alert("Upload failed: upload date is missing.");
      if (!metadata.publisher?.["@id"]) return alert("Upload failed: your WebID is missing. Please log in again.");
      if (!metadata.type || metadata.type.toArray().length === 0) return alert("Upload failed: file type could not be determined.");
     
      // Persist metadata to index.ttl
      const commitResult = await commitData(metadata);
      if (commitResult.isError) return alert(`Upload failed: the file metadata is invalid — ${commitResult.message}`);

      // Build final binary URI for the catalog entry and append to catalog with SPARQL PATCH
      const binaryUri = `${mainContainer.uri}${containerSlug}/${encodeURIComponent(pendingFile.name)}`;

      try {
        await appendToCatalog(
          catalogUri,
          indexResource.uri,
          binaryUri,
          classUri,
          pendingFile.type,
          pendingFile.size,
          title.trim() || pendingFile.name,
          description,
          new Date().toISOString(),
          session.webId!,
          solidFetch
        );
      } catch (catalogErr) {
        await solidFetch(binaryUri, { method: "DELETE" }).catch(() => {});
        await solidFetch(indexResource.uri, { method: "DELETE" }).catch(() => {});
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        alert(`Upload failed: catalog could not be updated. ${(catalogErr as Error).message}`);
        return;
      }
      // Link catalog once so future reads can discover it from the profile
      if (!profileHasCatalog) {
        await linkCatalogToProfile(catalogUri, session.webId!, solidFetch).catch(() => {});
      }

      setTitle("");
      setDescription("");
      setPendingFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  }, [mainContainer, catalogUri, profileHasCatalog, session, solidFetch, pendingFile, title, description, createData, commitData]);

  return (
    <form className="file-upload" onSubmit={handleSubmit}>
      <div className="file-upload__row">
        <label className="file-upload__label" htmlFor="file-upload-input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {translate("fileUpload.chooseFile")}
        </label>
        <input
          id="file-upload-input"
          ref={fileInputRef}
          type="file"
          onChange={(event) => setPendingFile(event.target.files?.[0])}
        />
        {pendingFile && (
          <span className="file-upload__selected">{pendingFile.name}</span>
        )}
      </div>

      {pendingFile && (
        <>
          <div className="file-upload__divider" />
          <input
            className="file-upload__title"
            type="text"
            placeholder={translate("fileUpload.titlePlaceholder")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="file-upload__body"
            placeholder={translate("fileUpload.descriptionPlaceholder")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
          <div className="file-upload__divider" />
          <div className="file-upload__footer">
            <span className="file-upload__meta">
              {pendingFile.type || translate("fileUpload.unknownType")} · {(pendingFile.size / 1024).toFixed(1)} KB
            </span>
            <button className="btn btn--primary" type="submit" disabled={isUploading}>
              {isUploading ? translate("fileUpload.uploading") : translate("fileUpload.upload")}
            </button>
          </div>
        </>
      )}
    </form>
  );
};
