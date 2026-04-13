/**
 * Application-wide constants and configuration.
 *
 * @remarks
 * All customizable values are defined here. This module is the single source
 * of truth for branding, providers, namespaces, and other app wide settings.
 *
 * @packageDocumentation
 */

// ============================================================================
// BRANDING
// ============================================================================

/**
 * Application display name.
 *
 * @public
 */
export const APP_NAME = "solid.drive";

// ============================================================================
// AUTHENTICATION PROVIDERS
// ============================================================================

/**
 * Configuration for a Solid identity provider.
 *
 * @public
 */
export type SolidProvider = {
  /** Human-readable provider name. */
  label: string;
  /** Provider URL or "custom" for manual entry. */
  value: string;
  /** Optional URL for new account registration. */
  registerUrl?: string;
};

/**
 * List of known Solid identity providers.
 *
 * @remarks
 * The last entry with value "custom" enables manual provider entry.
 * Customize this array to add/remove providers for your deployment.
 *
 * @public
 */
export const SOLID_PROVIDERS: SolidProvider[] = [
  { label: "solidcommunity.net", value: "https://solidcommunity.net", registerUrl: "https://solidcommunity.net/register" },
  { label: "inrupt.net", value: "https://inrupt.com", registerUrl: "https://start.inrupt.com/profile" },
  { label: "solidweb.org", value: "https://solidweb.org", registerUrl: "https://solidweb.org/register" },
  { label: "Custom…", value: "custom", registerUrl: undefined },
];

/**
 * Special value that indicates user wants to enter a custom provider URL.
 *
 * @public
 */
export const CUSTOM_PROVIDER_VALUE = "custom";

// ============================================================================
// INTERNATIONALIZATION
// ============================================================================

/**
 * Configuration for a supported language.
 *
 * @public
 */
export type Language = {
  /** ISO language code (e.g., "en", "de"). */
  code: string;
  /** Human-readable language name. */
  label: string;
};

/**
 * Supported languages for the UI.
 *
 * @remarks
 * Add new languages here and ensure corresponding locale files exist.
 *
 * @public
 */
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
];

/**
 * Default locale for date/number formatting.
 *
 * @public
 */
export const DEFAULT_LOCALE = "en-US";

// ============================================================================
// EXTERNAL LINKS
// ============================================================================

/**
 * External URLs referenced by the application.
 *
 * @public
 */
export const EXTERNAL_LINKS = {
  /** Link to Solid project information */
  solidProjectAbout: "https://solidproject.org/about",
  /** Fallback URL for pod registration when no provider-specific URL is available */
  defaultGetPod: "https://solidproject.org/users/get-a-pod",
} as const;

// ============================================================================
// FILE TYPES (basic constants - see end of file for those requiring RDF_NAMESPACES)
// ============================================================================

/**
 * File type definitions are loaded dynamically from the TBox TTL file.
 *
 * @remarks
 * See: `src/infrastructure/validation/fileTypeRegistry.ts`
 *
 * The FileTypeRegistry provides:
 * - `loadFileTypes()` - async loading from TTL
 * - `getFileType()` - lookup by URI or ID
 * - `getFileTypeLabel()` - get human-readable label
 * - `getAllFileTypes()` - get all loaded types
 *
 * Import from: `@/infrastructure/validation/fileTypeRegistry`
 */

/**
 * Default schema.org class for unknown file types.
 *
 * @public
 */
export const DEFAULT_FILE_TYPE_URI = "http://schema.org/DigitalDocument";

/**
 * Maximum length for descriptions extracted from TTL before truncation.
 *
 * @public
 */
export const FILE_TYPE_DESCRIPTION_MAX_LENGTH = 200;

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Path within the pod where app data is stored.
 *
 * @public
 */
export const APP_CONTAINER_PATH = "my-solid-app/";

/**
 * Prefix for per-contact shared catalog files.
 *
 * @public
 */
export const SHARED_CATALOG_PREFIX = ".shared-";

/**
 * Default catalog filename.
 *
 * @public
 */
export const DEFAULT_CATALOG_FILENAME = "catalog.ttl";

/**
 * System files that should be hidden from the user in the file explorer.
 *
 * @remarks
 * These are typically Solid system files or app specific metadata files.
 *
 * @public
 */
export const SYSTEM_FILES = new Set([
  "catalog.ttl",
  "robots.txt",
  "README",
  ".acl",
  ".meta",
]);

/**
 * Path for avatar uploads within the pod.
 *
 * @public
 */
export const AVATAR_UPLOAD_PATH = "public/avatar";

/**
 * Default index/metadata file for containers.
 *
 * @public
 */
export const INDEX_FILE = "index.ttl";

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Maximum length for display names before truncation.
 *
 * @public
 */
export const MAX_DISPLAY_NAME_LENGTH = 30;

/**
 * Delay in milliseconds before retrying storage discovery.
 *
 * @public
 */
export const STORAGE_RETRY_DELAY_MS = 10_000;

/**
 * Date formatting options for file timestamps.
 *
 * @public
 */
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * Short date formatting options (without time).
 *
 * @public
 */
export const SHORT_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

// ============================================================================
// RDF NAMESPACES
// ============================================================================

/**
 * Standard RDF/Linked Data namespace URIs used throughout the application.
 *
 * @remarks
 * Centralizing these prevents typos and makes updates easier.
 *
 * @public
 */
export const RDF_NAMESPACES = {
  /** Web Access Control namespace */
  ACL: "http://www.w3.org/ns/auth/acl#",
  /** Dublin Core Terms namespace */
  DCTERMS: "http://purl.org/dc/terms/",
  /** Data Catalog Vocabulary namespace */
  DCAT: "http://www.w3.org/ns/dcat#",
  /** Friend of a Friend namespace */
  FOAF: "http://xmlns.com/foaf/0.1/",
  /** Linked Data Platform namespace */
  LDP: "http://www.w3.org/ns/ldp#",
  /** RDF syntax namespace */
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  /** RDF Schema namespace */
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  /** Schema.org namespace */
  SCHEMA: "http://schema.org/",
  /** SHACL (Shapes Constraint Language) namespace */
  SHACL: "http://www.w3.org/ns/shacl#",
  /** Solid Access namespace */
  SOLID_ACCESS: "http://www.w3.org/ns/solid/access#",
  /** Solid Terms namespace */
  SOLID_TERMS: "http://www.w3.org/ns/solid/terms#",
  /** vCard namespace for contact/profile data */
  VCARD: "http://www.w3.org/2006/vcard/ns#",
  /** XML Schema namespace */
  XSD: "http://www.w3.org/2001/XMLSchema#",
} as const;

/**
 * Full URI for `rdf:type` predicate.
 *
 * @public
 */
export const RDF_TYPE_URI = `${RDF_NAMESPACES.RDF}type`;

// ============================================================================
// CONTENT TYPES
// ============================================================================

/**
 * MIME types used for Solid protocol HTTP headers.
 *
 * @public
 */
export const CONTENT_TYPES = {
  /** Turtle RDF format */
  TURTLE: "text/turtle",
  /** N3 RDF format */
  N3: "text/n3",
  /** SPARQL Update format */
  SPARQL_UPDATE: "application/sparql-update",
  /** Generic binary fallback */
  OCTET_STREAM: "application/octet-stream",
  /** PDF document */
  PDF: "application/pdf",
} as const;

// ============================================================================
// MIME TYPE PREFIXES
// ============================================================================

/**
 * MIME type prefix strings for broad media-type matching.
 *
 * @remarks
 * Use with `String.startsWith()` instead of hardcoding prefix literals.
 *
 * @public
 */
export const MIME_PREFIXES = {
  IMAGE: "image/",
  VIDEO: "video/",
  AUDIO: "audio/",
  TEXT: "text/",
} as const;

// ============================================================================
// MIME TYPE CLASSIFICATION
// ============================================================================

/**
 * MIME types classified as spreadsheet documents.
 *
 * @public
 */
export const SPREADSHEET_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/**
 * MIME types classified as text/document files.
 *
 * @public
 */
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
] as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Default path for the TBox (ontology/shapes) file.
 *
 * @public
 */
export const DEFAULT_TBOX_PATH = "/tbox.ttl";

// ============================================================================
// I18N CONFIGURATION
// ============================================================================

/**
 * Fallback language code when detection fails.
 *
 * @public
 */
export const FALLBACK_LANGUAGE = "en";

/**
 * Language codes for i18n (derived from SUPPORTED_LANGUAGES).
 *
 * @public
 */
export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((lang) => lang.code);

/**
 * Order of methods for detecting user language preference.
 *
 * @public
 */
export const LANGUAGE_DETECTION_ORDER = ["localStorage", "navigator"] as const;

/**
 * Where to cache the detected language.
 *
 * @public
 */
export const LANGUAGE_CACHE_LOCATIONS = ["localStorage"] as const;

// ============================================================================
// FILE TYPES (constants requiring RDF_NAMESPACES)
// ============================================================================

/**
 * Default file type definition structure for fallback when TTL cannot be loaded.
 *
 * @public
 */
export interface DefaultFileTypeDef {
  uri: string;
  id: string;
  label: string;
  description: string;
  parentTypes: string[];
}

/**
 * Default file types as fallback when TTL cannot be loaded or parsed.
 *
 * @remarks
 * Minimal set to ensure the app works even without the TTL file.
 *
 * @public
 */
export const DEFAULT_FILE_TYPES: DefaultFileTypeDef[] = [
  { uri: `${RDF_NAMESPACES.SCHEMA}DigitalDocument`, id: "DigitalDocument", label: "Digital document", description: "An electronic file or document.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}CreativeWork`] },
  { uri: `${RDF_NAMESPACES.SCHEMA}MediaObject`, id: "MediaObject", label: "Media object", description: "A media object, such as an image, video, or audio object.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}CreativeWork`] },
  { uri: `${RDF_NAMESPACES.SCHEMA}ImageObject`, id: "ImageObject", label: "Image", description: "An image file.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}MediaObject`] },
  { uri: `${RDF_NAMESPACES.SCHEMA}VideoObject`, id: "VideoObject", label: "Video", description: "A video file.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}MediaObject`] },
  { uri: `${RDF_NAMESPACES.SCHEMA}AudioObject`, id: "AudioObject", label: "Audio", description: "An audio file such as a song or podcast episode.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}MediaObject`] },
  { uri: `${RDF_NAMESPACES.SCHEMA}TextDigitalDocument`, id: "TextDigitalDocument", label: "Text digital document", description: "A file composed primarily of text.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}DigitalDocument`] },
  { uri: `${RDF_NAMESPACES.SCHEMA}SpreadsheetDigitalDocument`, id: "SpreadsheetDigitalDocument", label: "Spreadsheet digital document", description: "A spreadsheet file.", parentTypes: [`${RDF_NAMESPACES.SCHEMA}DigitalDocument`] },
];
