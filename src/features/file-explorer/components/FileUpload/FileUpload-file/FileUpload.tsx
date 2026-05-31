/**
 * File upload form with TBox validation.
 *
 * @packageDocumentation
 */

import { useCallback, useId, useRef, useState } from "react";
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
  prefilledFile?: File;
};

/**
 * Upload form for adding files to the user's Pod.
 * Creates a container, stores the binary, writes index.ttl metadata,
 * and adds the item to the catalog. Cleans up on partial failure.
 * Validation uses SHACL shapes from tbox.ttl.
 *
 * @public
 */
export const FileUpload: FunctionComponent<FileUploadProps> = ({ mainContainer, catalogUri, profileHasCatalog, onUploadSuccess, prefilledFile }) => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const { showError, showSuccess } = useNotifications();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | undefined>(prefilledFile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const titleInputId = useId();

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
  const fileMetaSummary = `${fileTypeLabel} · ${fileSizeKb}`;

  const submitButtonLabel = isUploading
    ? translate("fileUpload.uploading")
    : !canUpload
      ? translate("fileUpload.fillRequired")
      : translate("fileUpload.upload");

  const violationItems = nonTitleViolations.map((violation) => {
    const detail = violation.description ? `. ${violation.description}` : "";
    return (
      <p key={violation.path} className="file-upload__validation-item">
        <strong>{violation.label}</strong>
        {detail && <span>{detail}</span>}
      </p>
    );
  });

  const tboxErrorPrefix = translate("fileUpload.tboxError");
  const chooseFileLabel = translate("fileUpload.chooseFile");
  const titleFieldLabel = translate("fileUpload.title");
  const titlePlaceholder = translate("fileUpload.titlePlaceholder");
  const descriptionPlaceholder = translate("fileUpload.descriptionPlaceholder");
  const missingRequiredLabel = translate("fileUpload.missingRequired");
  const cancelLabel = translate("fileUpload.cancel");
  const hasNonTitleViolations = nonTitleViolations.length > 0;
  const submitDisabled = isUploading || !canUpload;
  const validationShapeLabel = validation?.shape?.label ?? "";
  const hasValidationShape = !!validation?.shape;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setPendingFile(event.target.files?.[0]);
  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setTitle(event.target.value);
  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setDescription(event.target.value);
  const handleCancel = useCallback(() => {
    setTitle("");
    setDescription("");
    setPendingFile(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUploadSuccess?.();
  }, [onUploadSuccess]);

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
      showSuccess(translate("fileUpload.uploadSuccess"));
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
    showSuccess,
    translate,
  ]);

  return (
    <form className="file-upload" onSubmit={handleSubmit}>
      {tboxError && (
        <p className="file-upload__validation-error">{tboxErrorPrefix} {tboxError}</p>
      )}
      <file-upload-row>
        <label className="file-upload__label" htmlFor={fileInputId}>
          {chooseFileLabel}
        </label>
        <input
          id={fileInputId}
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
          <file-upload-divider />
          <label className="file-upload__field-label" htmlFor={titleInputId}>
            {titleFieldLabel}{" "}
            {titleViolationMessage && (
              <span className="file-upload__field-error">{titleViolationMessage}</span>
            )}
          </label>
          <input
            id={titleInputId}
            className={titleClassName}
            type="text"
            placeholder={titlePlaceholder}
            value={title}
            onChange={handleTitleChange}
            required
          />
          <textarea
            className="file-upload__body"
            placeholder={descriptionPlaceholder}
            value={description}
            onChange={handleDescriptionChange}
            rows={2}
          />
          <file-upload-divider />

          {hasNonTitleViolations && (
            <file-upload-errors>
              <p className="file-upload__validation-heading">{missingRequiredLabel}</p>
              {violationItems}
            </file-upload-errors>
          )}

          <file-upload-footer>
            <span className="file-upload__meta">
              {fileMetaSummary}
              {hasValidationShape && (
                <span className="file-upload__type-label"> · {validationShapeLabel}</span>
              )}
            </span>
            <button
              className="btn btn--primary btn--primary-muted"
              type="button"
              onClick={handleCancel}
              disabled={isUploading}
            >
              {cancelLabel}
            </button>
            <button className="btn btn--primary" type="submit" disabled={submitDisabled}>
              {submitButtonLabel}
            </button>
          </file-upload-footer>
        </>
      )}
    </form>
  );
};
