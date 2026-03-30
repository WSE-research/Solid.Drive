import { useCallback, useEffect, useRef, useState } from "react";
import type { FunctionComponent } from "react";
import { useLdo, useSolidAuth } from "@ldo/solid-react";
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
 * Handles file uploads into the app container in the user's pod.
 *
 * The upload flow creates a dedicated container for the file, stores the binary,
 * writes RDF metadata to index.ttl, and then adds the new item to the catalog.
 * If a later step fails, it tries to delete any resources created earlier so the
 * pod does not end up with half-finished upload state.
 *
 * Validation is TBox-driven: shapes are loaded from tbox.ttl (sourced from
 * datashapes.org). Required fields are enforced; missing fields prompt the user.
 */
export const FileUpload: FunctionComponent<FileUploadProps> = ({ mainContainer, catalogUri, profileHasCatalog, onUploadSuccess }) => {
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
      type: [{ "@id": typeLocalName }], // cosmetic — not used by SHACL validation (classUri is used for shape lookup)
    };
    setValidation(validateMetadata(snapshot, classUri, tbox.shapes, tbox.parents));
  }, [tbox, pendingFile, title, description, session.webId]);

  // Map violations to the fields the user can fix in this form
  const titleViolation = validation?.violations.find(
    (violation) => violation.localName === "name"
  );
  // Violations the user can't fix in this form
  const autoViolations = validation?.violations.filter(
    (violation) => violation.localName !== "name"
  ) ?? [];
  const canUpload = !validation || validation.valid;

  /**
   * Upload pipeline:
   *   1. Resolve schema.org class from MIME type.
   *   2. Create a container named after the file (slugified).
   *   3. Upload the binary into that container.
   *   4. Write LDO metadata to index.ttl.
   *   5. Append a DCAT catalog entry via SPARQL PATCH.
   *   6. Link the catalog to the profile on first upload.
   *
   * On binary upload failure (step 3) deletes the container.
   * On catalog failure (step 5) deletes the container, binary, and index.ttl.
   * Step 4 (commitData) does not roll back.
   */
  const handleSubmit = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.webId || !pendingFile) return;

    // TBox validation gate — block upload if required fields are missing
    if (validation && !validation.valid) return;

    setIsUploading(true);
    let containerSlug: string | undefined;

    try {
      const classUri = resolveClass(pendingFile.type);

      // Use a safe folder name so the container URI is predictable
      containerSlug = pendingFile.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const fileExtension = pendingFile.name.includes(".") ? pendingFile.name.split(".").pop()! : "";
      const safeFileName = fileExtension
        ? `${containerSlug.replace(/\.[^.]+$/, "")}.${fileExtension}`
        : containerSlug;
      const containerUri = `${containerSlug}/` as SolidContainerUri;
      // Create a container per file (binary and index.ttl live together)
      const containerResult = await mainContainer.createChildAndOverwrite(containerUri) as ContainerCreationResult;
      if (containerResult.isError) return alert(containerResult.message);
      const fileContainer = containerResult.resource;

      // Upload the file with its MIME type so it is stored and served correctly.
      const uploadResult = await fileContainer.uploadChildAndOverwrite(
        safeFileName,
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
        const binaryUri = `${mainContainer.uri}${containerSlug}/${safeFileName}`;
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

      // Persist metadata to index.ttl
      const commitResult = await commitData(metadata);
      if (commitResult.isError) {
        const binaryUri = `${mainContainer.uri}${containerSlug}/${safeFileName}`;
        await solidFetch(binaryUri, { method: "DELETE" }).catch(() => {});
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        alert(`Upload failed: the file metadata is invalid — ${commitResult.message}`);
        return;
      }

      const binaryUri = `${mainContainer.uri}${containerSlug}/${safeFileName}`;

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
        <p className="file-upload__validation-error">TBox could not be loaded: {tboxError}</p>
      )}
      <div className="file-upload__row">
        <label className="file-upload__label" htmlFor="file-upload-input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Choose file
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
            Title {titleViolation && <span className="file-upload__field-error">— {titleViolation.label} is required</span>}
          </label>
          <input
            id="file-upload-title"
            className={`file-upload__title${titleViolation ? " file-upload__title--error" : ""}`}
            type="text"
            placeholder="Add a title…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <textarea
            className="file-upload__body"
            placeholder="Add a description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
          <div className="file-upload__divider" />

          {autoViolations.length > 0 && (
            <div className="file-upload__validation-errors">
              <p className="file-upload__validation-heading">Missing required fields:</p>
              {autoViolations.map((v) => (
                <p key={v.path} className="file-upload__validation-item">
                  <strong>{v.label}</strong>
                  {v.description && <span> — {v.description}</span>}
                </p>
              ))}
            </div>
          )}

          <div className="file-upload__footer">
            <span className="file-upload__meta">
              {pendingFile.type || "unknown datatype"} · {(pendingFile.size / 1024).toFixed(1)} KB
              {validation?.shape && (
                <span className="file-upload__type-label"> · {validation.shape.label}</span>
              )}
            </span>
            <button className="btn btn--primary" type="submit" disabled={isUploading || !canUpload}>
              {isUploading ? "Uploading…" : !canUpload ? "Fill required fields" : "Upload"}
            </button>
          </div>
        </>
      )}
    </form>
  );
};
