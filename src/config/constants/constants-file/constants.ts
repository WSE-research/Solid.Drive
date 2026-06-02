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
export const APP_NAME = "Solid.drive";

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
  /** Public GitHub repository for the project */
  githubRepo: "https://github.com/WSE-research/Solid-Hello-World-Frontend-React",
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
  /** Solid Notifications namespace */
  NOTIFY: "http://www.w3.org/ns/solid/notifications#",
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
// REQUEST NOTIFICATIONS
// ============================================================================

/**
 * `localStorage` key under which the set of "already seen" inbox
 * request message URIs is persisted.
 *
 * @public
 */
export const SEEN_REQUESTS_STORAGE_KEY = "solid-drive.seenRequestIds";

/**
 * Custom DOM event name dispatched when the seen-requests set changes,
 * used to keep multiple in-tab hook instances in sync.
 *
 * @public
 */
export const SEEN_REQUESTS_CHANGE_EVENT = "solid-drive:seen-requests-changed";

/**
 * Maximum number of seen-request message URIs retained in storage.
 * Older entries are dropped FIFO once the cap is reached.
 *
 * @public
 */
export const SEEN_REQUESTS_MAX_STORED = 500;

/**
 * `localStorage` key under which the set of access-request targets still
 * awaiting a decision (the "pending" set) is persisted.
 *
 * @public
 */
export const PENDING_REQUESTS_STORAGE_KEY = "solid-drive.pendingRequestIds";

/**
 * Custom DOM event name dispatched when the pending-requests set changes,
 * used to keep multiple in-tab hook instances in sync.
 *
 * @public
 */
export const PENDING_REQUESTS_CHANGE_EVENT = "solid-drive:pending-requests-changed";

/**
 * Time in milliseconds the toast firer waits for a requester's Solid
 * profile to resolve before falling back to a WebID-derived name.
 *
 * @public
 */
export const REQUEST_TOAST_PROFILE_RESOLVE_TIMEOUT_MS = 1500;

/**
 * Maximum number of recent requests rendered inside the notification
 * bell dropdown. Older entries stay reachable via the Requests view.
 *
 * @public
 */
export const NOTIFICATION_BELL_MAX_DROPDOWN_ITEMS = 6;

/**
 * Highest unread count rendered as a literal numeric badge. Counts
 * above this render as `{value}+`.
 *
 * @public
 */
export const NOTIFICATION_BELL_MAX_BADGE_DISPLAY = 9;

/**
 * Solid Notifications Protocol channel-type URI for the
 * `WebSocketChannel2023` transport, used both to advertise channel
 * support in the storage description and as the subscription `type`
 * field in the POST body.
 *
 * @public
 */
export const SOLID_NOTIFICATION_WEBSOCKET_CHANNEL_TYPE = `${RDF_NAMESPACES.NOTIFY}WebSocketChannel2023`;

/**
 * Link-header relation that points from any resource to its storage
 * description document, used to discover the pod's notification
 * subscription endpoint.
 *
 * @public
 */
export const SOLID_STORAGE_DESCRIPTION_REL = `${RDF_NAMESPACES.SOLID_TERMS}storageDescription`;

/**
 * JSON-LD context URL embedded in subscription request bodies for the
 * Solid Notifications Protocol.
 *
 * @public
 */
export const SOLID_NOTIFICATION_CONTEXT_URL = "https://www.w3.org/ns/solid/notification/v1";

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
 * @remarks
 * Prefixed with Vite's BASE_URL so the path resolves under the
 * configured `base` (e.g. `/solid-hello-world-frontend-react/`).
 * Using a bare `/tbox.ttl` would 404 because Vite serves
 * `public/tbox.ttl` at `${BASE_URL}tbox.ttl`, not at the origin root.
 *
 * @public
 */
export const DEFAULT_TBOX_PATH = `${import.meta.env.BASE_URL}tbox.ttl`;

// ============================================================================
// ROUTING
// ============================================================================

/**
 * Application base path used as react-router-dom's `basename`.
 *
 * @remarks
 * Derived from Vite's `BASE_URL` so it stays in sync with the value
 * configured in `vite.config.ts`. The trailing slash is stripped because
 * `BrowserRouter.basename` rejects it.
 *
 * @public
 */
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

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
