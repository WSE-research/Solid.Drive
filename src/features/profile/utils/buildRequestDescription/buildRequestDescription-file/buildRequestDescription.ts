/**
 * Shared i18n description builder for inbox access requests.
 *
 * Picks the correct translation key and interpolation values for a
 * single {@link AccessRequest} so every surface that renders a request
 * (notification bell, toast, OneDrive card, classic panel) reads the
 * same sentence.
 *
 * @packageDocumentation
 */

import type { TFunction } from "i18next";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";
import { getFileTypeInfo } from "@/infrastructure/validation/fileTypeRegistry";

const REQUEST_FILE_KEY = "requestsPanel.requestsFileAccess";
const REQUEST_TYPE_KEY = "requestsPanel.requestsTypeAccess";
const REQUEST_DEFAULT_KEY = "requestsPanel.requestsAccess";

/**
 * Final path segment of a container or resource URI, percent-decoded.
 *
 * @public
 */
export const getResourceLabel = (accessTo: string): string =>
  decodeURIComponent(accessTo.replace(/\/$/, "").split("/").pop() ?? accessTo);

/**
 * Human-readable label for the schema.org class behind a type request.
 *
 * @public
 */
export const getTypeLabel = (forClass: string): string =>
  getFileTypeInfo(forClass).label;

/**
 * Builds the translated description for an access request.
 *
 * @public
 */
export const buildRequestDescription = (
  request: AccessRequest,
  translate: TFunction,
): string => {
  if (request.requestType === "file") {
    return translate(REQUEST_FILE_KEY, {
      resource: getResourceLabel(request.accessTo),
    });
  }
  if (request.requestType === "type" && request.forClass) {
    return translate(REQUEST_TYPE_KEY, { type: getTypeLabel(request.forClass) });
  }
  return translate(REQUEST_DEFAULT_KEY);
};
