/**
 * File card info panel showing detailed metadata.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/shared/utils/formatBytes";

/**
 * File type information with label and description.
 */
type FileTypeInfo = { label: string; description: string };

/**
 * Props for the FileCardInfoPanel component.
 */
type FileCardInfoPanelProps = {
  name?: string;
  description?: string;
  encodingFormat?: string;
  contentSize?: string;
  isPartOf?: { "@id": string };
  uploadedAt: string;
  dateModified: string;
  fileType: FileTypeInfo;
  publisherName?: string;
  publisherWebId?: string;
};

/**
 * Displays detailed file metadata in an expandable panel.
 * Shows type, title, description, format, size, dates, and publisher.
 *
 * @public
 */
export const FileCardInfoPanel: FunctionComponent<FileCardInfoPanelProps> = ({
  name,
  description,
  encodingFormat,
  contentSize,
  isPartOf,
  uploadedAt,
  dateModified,
  fileType,
  publisherName,
  publisherWebId,
}) => {
  const [translate] = useTranslation();

  return (
    <file-card-schema>
      <file-card-schema-row>
        <span className="file-card__schema-label">{translate("fileCard.fileType")}</span>
        <span className="file-card__schema-value">
          <span className="file-card__type-badge">{fileType.label}</span>
          {fileType.description && (
            <span className="file-card__type-note">{fileType.description}</span>
          )}
        </span>
      </file-card-schema-row>

      {name && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.title")}</span>
          <span className="file-card__schema-value">{name}</span>
        </file-card-schema-row>
      )}
      {description && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.description")}</span>
          <span className="file-card__schema-value">{description}</span>
        </file-card-schema-row>
      )}
      {encodingFormat && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.format")}</span>
          <span className="file-card__schema-value">{encodingFormat}</span>
        </file-card-schema-row>
      )}
      {contentSize && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.size")}</span>
          <span className="file-card__schema-value">{formatBytes(contentSize)}</span>
        </file-card-schema-row>
      )}
      {uploadedAt && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.uploadedOn")}</span>
          <span className="file-card__schema-value">{uploadedAt}</span>
        </file-card-schema-row>
      )}
      {dateModified && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.lastUpdated")}</span>
          <span className="file-card__schema-value">{dateModified}</span>
        </file-card-schema-row>
      )}
      {publisherWebId && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.uploadedBy")}</span>
          <span className="file-card__schema-value">{publisherName}</span>
        </file-card-schema-row>
      )}
      {isPartOf?.["@id"] && (
        <file-card-schema-row>
          <span className="file-card__schema-label">{translate("fileCard.partOf")}</span>
          <span className="file-card__schema-value file-card__schema-value--uri">
            {isPartOf["@id"]}
          </span>
        </file-card-schema-row>
      )}
    </file-card-schema>
  );
};
