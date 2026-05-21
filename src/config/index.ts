/**
 * @packageDocumentation
 * Configuration module exports
 *
 * Provides centralized access to environment variables, application constants,
 * and type definitions. File type definitions are loaded dynamically from TBox.
 */

export { ENV } from "./env";
export {
  // Branding
  APP_NAME,
  // Auth providers
  SOLID_PROVIDERS,
  CUSTOM_PROVIDER_VALUE,
  // i18n
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LOCALE,
  FALLBACK_LANGUAGE,
  LANGUAGE_DETECTION_ORDER,
  LANGUAGE_CACHE_LOCATIONS,
  // External links
  EXTERNAL_LINKS,
  // File types
  DEFAULT_FILE_TYPE_URI,
  FILE_TYPE_DESCRIPTION_MAX_LENGTH,
  DEFAULT_FILE_TYPES,
  // Storage
  APP_CONTAINER_PATH,
  SHARED_CATALOG_PREFIX,
  DEFAULT_CATALOG_FILENAME,
  SYSTEM_FILES,
  AVATAR_UPLOAD_PATH,
  INDEX_FILE,
  // UI
  MAX_DISPLAY_NAME_LENGTH,
  STORAGE_RETRY_DELAY_MS,
  DATE_FORMAT_OPTIONS,
  SHORT_DATE_FORMAT_OPTIONS,
  // RDF Namespaces
  RDF_NAMESPACES,
  RDF_TYPE_URI,
  // Request notifications
  SEEN_REQUESTS_STORAGE_KEY,
  SEEN_REQUESTS_CHANGE_EVENT,
  SEEN_REQUESTS_MAX_STORED,
  REQUEST_TOAST_PROFILE_RESOLVE_TIMEOUT_MS,
  NOTIFICATION_BELL_MAX_DROPDOWN_ITEMS,
  NOTIFICATION_BELL_MAX_BADGE_DISPLAY,
  SOLID_NOTIFICATION_WEBSOCKET_CHANNEL_TYPE,
  SOLID_STORAGE_DESCRIPTION_REL,
  SOLID_NOTIFICATION_CONTEXT_URL,
  // Content types
  CONTENT_TYPES,
  // MIME type prefixes
  MIME_PREFIXES,
  // MIME type classification
  SPREADSHEET_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  // Validation
  DEFAULT_TBOX_PATH,
} from "./constants";
export type { SolidProvider, Language, DefaultFileTypeDef } from "./constants";

// NOTE: File type definitions are now loaded dynamically from the TBox TTL file.
// Import from "@/infrastructure/validation/fileTypeRegistry" for:
// - FileTypeDef type
// - loadFileTypes() - async loading from TTL
// - getFileType() - lookup by URI or ID
// - getFileTypeLabel() - get human-readable label
// - getAllFileTypes() - get all loaded types
// - resolveClass() - resolve MIME type to schema.org class URI
// - etc.
