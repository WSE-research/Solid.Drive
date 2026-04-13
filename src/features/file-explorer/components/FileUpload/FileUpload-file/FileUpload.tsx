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

  const titleViolation = validation?.violations.find((violation) => violation.localName === "name");
  const nonTitleViolations = validation?.violations.filter((violation) => violation.localName !== "name") ?? [];
  const canUpload = !validation || validation.valid;

  const titleClassName = `file-upload__title${titleViolation ? " file-upload__title--error" : ""}`;
  const titleViolationMessage = titleViolation
    ? translate("fileUpload.fieldRequired", { label: titleViolation.label })
    : undefined;

  const fileSizeKb = pendingFile ? `${(pendingFile.size / 1024).toFixed(1)} KB` : "";
  const fileTypeLabel = pendingFile?.type || translate("fileUpload.unknownType");

  const submitButtonLabel = isUploading
    ? translate("fileUpload.uploading")
    : !canUpload
      ? translate("fileUpload.fillRequired")
      : translate("fileUpload.upload");

  const violationsWithDetail = nonTitleViolations.map((violation) => ({
    ...violation,
    detail: violation.description ? ` — ${violation.description}` : "",
  }));
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setPendingFile(event.target.files?.[0]);
  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setTitle(event.target.value);
  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setDescription(event.target.value);

  const handleSubmit = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.webId || !pendingFile) return;
    if (validation && !validation.valid) return;

    try {
      await upload({ 
        file: pendingFile, 
        title, description, 
        mainContainer, 
        catalogUri, 
        profileHasCatalog 
      });
      onUploadSuccess?.();
      setTitle("");
      setDescription("");
      setPendingFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showSuccess("File uploaded successfully");
    } catch (err) {
      showError(`Upload failed: ${(err as Error).message}`);
    }
  }, [
    session.webId, 
    pendingFile, 
    validation, 
    upload, 
    title, 
    description, 
    mainContainer, 
    catalogUri, 
    profileHasCatalog, 
    onUploadSuccess, 
    showError, 
    showSuccess
  ]);

  return (
    <form className="file-upload" onSubmit={handleSubmit}>
      {tboxError && (
        <p className="file-upload__validation-error">{translate("fileUpload.tboxError")} {tboxError}</p>
      )}
      <file-upload-row>
        <label className="file-upload__label" htmlFor="file-upload-input">
          {translate("fileUpload.chooseFile")}
        </label>
        <input
          id="file-upload-input"
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
        />
        {pendingFile && (
          <span className="file-upload__selected">{pendingFile.name}</span>
        )}
      </file-upload-row>

      {pendingFile && (
        <>
          <div className="file-upload__divider" />
          <label className="file-upload__field-label" htmlFor="file-upload-title">
            {translate("fileUpload.title")}{" "}
            {titleViolationMessage && (
              <span className="file-upload__field-error">{titleViolationMessage}</span>
            )}
          </label>
          <input
            id="file-upload-title"
            className={titleClassName}
            type="text"
            placeholder={translate("fileUpload.titlePlaceholder")}
            value={title}
            onChange={handleTitleChange}
            required
          />
          <textarea
            className="file-upload__body"
            placeholder={translate("fileUpload.descriptionPlaceholder")}
            value={description}
            onChange={handleDescriptionChange}
            rows={2}
          />
          <div className="file-upload__divider" />

          {nonTitleViolations.length > 0 && (
            <file-upload-errors>
              <p className="file-upload__validation-heading">{translate("fileUpload.missingRequired")}</p>
              {violationsWithDetail.map((violation) => (
                <p key={violation.path} className="file-upload__validation-item">
                  <strong>{violation.label}</strong>
                  {violation.detail && <span>{violation.detail}</span>}
                </p>
              ))}
            </file-upload-errors>
          )}

          <file-upload-footer>
            <span className="file-upload__meta">
              {fileTypeLabel} · {fileSizeKb}
              {validation?.shape && (
                <span className="file-upload__type-label"> · {validation.shape.label}</span>
              )}
            </span>
            <button className="btn btn--primary" type="submit" disabled={isUploading || !canUpload}>
              {submitButtonLabel}
            </button>
          </file-upload-footer>
        </>
      )}
    </form>
  );
};
