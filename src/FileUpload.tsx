import { useCallback, useEffect, useRef, useState } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { CatalogEntryShShapeType } from "./.ldo/catalogEntry.shapeTypes";
import { isSolidLeaf } from "./pod";
import { resolveClass, appendToCatalog, linkCatalogToProfile } from "./podCatalog";
import type { ContainerCreationResult } from "./pod";
import type { SolidContainer, SolidContainerUri } from "@ldo/connected-solid";
import { loadTBox, validateMetadata, type ShapeDefinition, type ValidationResult, } from "./tboxValidator";

type FileUploadProps = {
  mainContainer: SolidContainer;
  catalogUri: string;
  profileHasCatalog: boolean;
  onUploadSuccess?: () => void;
};

/**
 * Upload a file to the user's pod.
 * Creates a container, stores the binary, writes index.ttl metadata,
 * and adds the item to the catalog. Cleans up on partial failure.
 * Validation uses TBox shapes from tbox.ttl.
 */
export const FileUpload: FunctionComponent<FileUploadProps> = ({ mainContainer, catalogUri, profileHasCatalog, onUploadSuccess }) => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const { createData, commitData } = useLdo();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tbox, setTbox] = useState<{ shapes: Map<string, ShapeDefinition>; parents: Map<string, string[]> } | null>(null);
  const [tboxError, setTboxError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Loads the TBox once so form validation can use the active shapes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadTBox();
        if (!cancelled) setTbox(result);
      } catch (err) {
        if (!cancelled) setTboxError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Re-validate whenever form state or TBox changes
  useEffect(() => {
    if (!tbox || !pendingFile) {
      setValidation(null);
      return;
    }
    const classUri = resolveClass(pendingFile.type);
    const typeLocalName = classUri.split(/[#/]/).pop() ?? "DigitalDocument";
    const snapshot: Record<string, unknown> = {
      name: title.trim() || pendingFile.name,
      description: description.trim() || undefined,
      encodingFormat: pendingFile.type || undefined,
      contentSize: pendingFile.size.toString(),
      uploadDate: new Date().toISOString(),
      publisher: { "@id": session.webId ?? "" },
      type: [{ "@id": typeLocalName }],
    };
    setValidation(validateMetadata(snapshot, classUri, tbox.shapes, tbox.parents));
  }, [tbox, pendingFile, title, description, session.webId]);

  const titleViolation = validation?.violations.find(
    (violation) => violation.localName === "name"
  );
  const autoViolations = validation?.violations.filter(
    (violation) => violation.localName !== "name"
  ) ?? [];
  const canUpload = !validation || validation.valid;

  const handleSubmit = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.webId || !pendingFile) return;

    if (validation && !validation.valid) return;

    setIsUploading(true);
    let containerSlug: string | undefined;

    try {
      const classUri = resolveClass(pendingFile.type);

      containerSlug = pendingFile.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-");
      const containerUri = `${containerSlug}/` as SolidContainerUri;
      const containerResult = await mainContainer.createChildAndOverwrite(containerUri) as ContainerCreationResult;
      if (containerResult.isError) return alert(containerResult.message);
      const fileContainer = containerResult.resource;

      const uploadResult = await fileContainer.uploadChildAndOverwrite(
        pendingFile.name,
        pendingFile,
        pendingFile.type || "application/octet-stream"
      );

      if (uploadResult.isError) {
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        alert(uploadResult.message);
        return;
      }
      const indexResource = fileContainer.child("index.ttl");
      if (!isSolidLeaf(indexResource)) {
        const binaryUri = `${mainContainer.uri}${containerSlug}/${pendingFile.name}`;
        await solidFetch(binaryUri, { method: "DELETE" }).catch(() => {});
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        alert("Could not create metadata resource.");
        return;
      }

      const metadata = createData(CatalogEntryShShapeType, indexResource.uri, indexResource);
      const typeLocalName = (classUri.split(/[#/]/).pop() ?? "DigitalDocument") as
        "DigitalDocument" | "ImageObject" | "VideoObject" | "AudioObject" | "TextDigitalDocument" | "SpreadsheetDigitalDocument";

      metadata.type.add({ "@id": typeLocalName });
      metadata.name = title.trim() || pendingFile.name;
      metadata.encodingFormat = pendingFile.type || undefined;
      metadata.contentSize = pendingFile.size.toString();
      metadata.uploadDate = new Date().toISOString();
      metadata.publisher = { "@id": session.webId };
      if (description.trim()) metadata.description = description.trim();

      const commitResult = await commitData(metadata);
      if (commitResult.isError) return alert(`Upload failed: the file metadata is invalid — ${commitResult.message}`);

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
      if (!profileHasCatalog) {
        await linkCatalogToProfile(catalogUri, session.webId!, solidFetch).catch(() => {});
      }

      onUploadSuccess?.();
      setTitle("");
      setDescription("");
      setPendingFile(undefined);
      setValidation(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  }, [mainContainer, catalogUri, profileHasCatalog, onUploadSuccess, session, solidFetch, pendingFile, title, description, createData, commitData, validation]);

  return (
    <form className="file-upload" onSubmit={handleSubmit}>
      {tboxError && (
        <p className="file-upload__validation-error">{translate("fileUpload.tboxError")} {tboxError}</p>
      )}
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
          <label className="file-upload__field-label" htmlFor="file-upload-title">
            {translate("fileUpload.title")} {titleViolation && <span className="file-upload__field-error">{translate("fileUpload.fieldRequired", { label: titleViolation.label })}</span>}
          </label>
          <input
            id="file-upload-title"
            className={`file-upload__title${titleViolation ? " file-upload__title--error" : ""}`}
            type="text"
            placeholder={translate("fileUpload.titlePlaceholder")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <textarea
            className="file-upload__body"
            placeholder={translate("fileUpload.descriptionPlaceholder")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
          <div className="file-upload__divider" />

          {autoViolations.length > 0 && (
            <div className="file-upload__validation-errors">
              <p className="file-upload__validation-heading">{translate("fileUpload.missingRequired")}</p>
              {autoViolations.map((violation) => (
                <p key={violation.path} className="file-upload__validation-item">
                  <strong>{violation.label}</strong>
                  {violation.description && <span> — {violation.description}</span>}
                </p>
              ))}
            </div>
          )}

          <div className="file-upload__footer">
            <span className="file-upload__meta">
              {pendingFile.type || translate("fileUpload.unknownType")} · {(pendingFile.size / 1024).toFixed(1)} KB
              {validation?.shape && (
                <span className="file-upload__type-label"> · {validation.shape.label}</span>
              )}
            </span>
            <button className="btn btn--primary" type="submit" disabled={isUploading || !canUpload}>
              {isUploading ? translate("fileUpload.uploading") : !canUpload ? translate("fileUpload.fillRequired") : translate("fileUpload.upload")}
            </button>
          </div>
        </>
      )}
    </form>
  );
};
