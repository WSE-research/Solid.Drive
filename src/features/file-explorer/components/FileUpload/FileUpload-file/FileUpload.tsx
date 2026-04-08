/**
 * File upload form with TBox validation.
 *
 * @packageDocumentation
 */

import { useCallback, useRef, useState } from "react";
import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import type { SolidContainer } from "@ldo/connected-solid";
import { useFileValidation } from "@/features/file-explorer/hooks/useFileValidation";
import { useFileUpload } from "@/features/file-explorer/hooks/useFileUpload";
import { useNotifications } from "@/shared/contexts/NotificationContext";
import { useSolidAuth } from "@ldo/solid-react";

/**
 * Props for the FileUpload component.
 */
type FileUploadProps = {
  mainContainer: SolidContainer;
  catalogUri: string;
  profileHasCatalog: boolean;
  onUploadSuccess?: () => void;
};

/**
 * Upload form for adding files to the user's Pod.
 * Creates a container, stores the binary, writes index.ttl metadata,
 * and adds the item to the catalog. Cleans up on partial failure.
 * Validation uses SHACL shapes from tbox.ttl.
 *
 * @public
 */
export const FileUpload: FunctionComponent<FileUploadProps> = ({ mainContainer, catalogUri, profileHasCatalog, onUploadSuccess }) => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const { showError, showSuccess } = useNotifications();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { validation, tboxError } = useFileValidation(pendingFile, title, description, session.webId);
  const { isUploading, upload } = useFileUpload();

  const titleViolation = validation?.violations.find((v) => v.localName === "name");
  const autoViolations = validation?.violations.filter((v) => v.localName !== "name") ?? [];
  const canUpload = !validation || validation.valid;

  const handleSubmit = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.webId || !pendingFile) return;
    if (validation && !validation.valid) return;

    try {
      await upload({ file: pendingFile, title, description, mainContainer, catalogUri, profileHasCatalog });
      onUploadSuccess?.();
      setTitle("");
      setDescription("");
      setPendingFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showSuccess("File uploaded successfully");
    } catch (err) {
      showError(`Upload failed: ${(err as Error).message}`);
    }
  }, [session.webId, pendingFile, validation, upload, title, description, mainContainer, catalogUri, profileHasCatalog, onUploadSuccess, showError, showSuccess]);

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
            {translate("fileUpload.title")}{" "}
            {titleViolation && (
              <span className="file-upload__field-error">
                {translate("fileUpload.fieldRequired", { label: titleViolation.label })}
              </span>
            )}
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
              {isUploading
                ? translate("fileUpload.uploading")
                : !canUpload
                  ? translate("fileUpload.fillRequired")
                  : translate("fileUpload.upload")}
            </button>
          </div>
        </>
      )}
    </form>
  );
};
