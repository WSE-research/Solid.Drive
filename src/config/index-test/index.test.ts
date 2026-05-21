import { describe, it, expect } from "vitest";
import * as Config from "..";

describe("config/index exports", () => {
  it("exports ENV", () => {
    expect(Config.ENV).toBeDefined();
    expect(typeof Config.ENV).toBe("object");
  });

  const expectedConstants = [
    "APP_NAME",
    "SOLID_PROVIDERS",
    "CUSTOM_PROVIDER_VALUE",
    "SUPPORTED_LANGUAGES",
    "SUPPORTED_LANGUAGE_CODES",
    "DEFAULT_LOCALE",
    "FALLBACK_LANGUAGE",
    "LANGUAGE_DETECTION_ORDER",
    "LANGUAGE_CACHE_LOCATIONS",
    "EXTERNAL_LINKS",
    "DEFAULT_FILE_TYPE_URI",
    "FILE_TYPE_DESCRIPTION_MAX_LENGTH",
    "DEFAULT_FILE_TYPES",
    "APP_CONTAINER_PATH",
    "SHARED_CATALOG_PREFIX",
    "DEFAULT_CATALOG_FILENAME",
    "SYSTEM_FILES",
    "AVATAR_UPLOAD_PATH",
    "INDEX_FILE",
    "MAX_DISPLAY_NAME_LENGTH",
    "STORAGE_RETRY_DELAY_MS",
    "DATE_FORMAT_OPTIONS",
    "SHORT_DATE_FORMAT_OPTIONS",
    "RDF_NAMESPACES",
    "RDF_TYPE_URI",
    "CONTENT_TYPES",
    "MIME_PREFIXES",
    "SPREADSHEET_MIME_TYPES",
    "DOCUMENT_MIME_TYPES",
    "DEFAULT_TBOX_PATH",
    "SEEN_REQUESTS_STORAGE_KEY",
    "SEEN_REQUESTS_CHANGE_EVENT",
    "SEEN_REQUESTS_MAX_STORED",
    "REQUEST_TOAST_PROFILE_RESOLVE_TIMEOUT_MS",
    "NOTIFICATION_BELL_MAX_DROPDOWN_ITEMS",
    "NOTIFICATION_BELL_MAX_BADGE_DISPLAY",
    "SOLID_NOTIFICATION_WEBSOCKET_CHANNEL_TYPE",
    "SOLID_STORAGE_DESCRIPTION_REL",
    "SOLID_NOTIFICATION_CONTEXT_URL",
  ] as const;

  it.each(expectedConstants)("exports %s", (name) => {
    expect((Config as Record<string, unknown>)[name]).toBeDefined();
  });

  it("exports exactly the expected number of runtime values", () => {
    // 40 constants + ENV
    expect(Object.keys(Config)).toHaveLength(40);
  });
});
