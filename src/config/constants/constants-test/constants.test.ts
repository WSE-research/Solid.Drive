import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_CONTAINER_PATH,
  AVATAR_UPLOAD_PATH,
  CONTENT_TYPES,
  CUSTOM_PROVIDER_VALUE,
  DATE_FORMAT_OPTIONS,
  DEFAULT_CATALOG_FILENAME,
  DEFAULT_FILE_TYPES,
  DEFAULT_FILE_TYPE_URI,
  DEFAULT_LOCALE,
  DEFAULT_TBOX_PATH,
  DOCUMENT_MIME_TYPES,
  EXTERNAL_LINKS,
  FALLBACK_LANGUAGE,
  FILE_TYPE_DESCRIPTION_MAX_LENGTH,
  INDEX_FILE,
  LANGUAGE_CACHE_LOCATIONS,
  LANGUAGE_DETECTION_ORDER,
  MAX_DISPLAY_NAME_LENGTH,
  MIME_PREFIXES,
  RDF_NAMESPACES,
  RDF_TYPE_URI,
  SHARED_CATALOG_PREFIX,
  SHORT_DATE_FORMAT_OPTIONS,
  SOLID_PROVIDERS,
  SPREADSHEET_MIME_TYPES,
  STORAGE_RETRY_DELAY_MS,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  SYSTEM_FILES,
} from '../constants-file/constants';

// ─── APP_NAME ─────────────────────────────────────────────────────────────────

describe("APP_NAME", () => {
  it("is a non-empty string", () => {
    expect(typeof APP_NAME).toBe("string");
    expect(APP_NAME.length).toBeGreaterThan(0);
  });
});

// ─── SOLID_PROVIDERS ──────────────────────────────────────────────────────────

describe("SOLID_PROVIDERS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SOLID_PROVIDERS)).toBe(true);
    expect(SOLID_PROVIDERS.length).toBeGreaterThan(0);
  });

  it("every entry has a label and value", () => {
    for (const p of SOLID_PROVIDERS) {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
      expect(typeof p.value).toBe("string");
      expect(p.value.length).toBeGreaterThan(0);
    }
  });

  it("includes a 'custom' entry as the last element", () => {
    const last = SOLID_PROVIDERS[SOLID_PROVIDERS.length - 1];
    expect(last.value).toBe(CUSTOM_PROVIDER_VALUE);
  });

  it("non-custom entries have https registerUrl values", () => {
    for (const p of SOLID_PROVIDERS) {
      if (p.value === "custom") continue;
      expect(p.registerUrl).toMatch(/^https?:\/\//);
    }
  });
});

// ─── CUSTOM_PROVIDER_VALUE ────────────────────────────────────────────────────

describe("CUSTOM_PROVIDER_VALUE", () => {
  it('equals "custom"', () => {
    expect(CUSTOM_PROVIDER_VALUE).toBe("custom");
  });
});

// ─── SUPPORTED_LANGUAGES ──────────────────────────────────────────────────────

describe("SUPPORTED_LANGUAGES", () => {
  it("is a non-empty array", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty code and label", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(typeof lang.code).toBe("string");
      expect(lang.code.length).toBeGreaterThan(0);
      expect(typeof lang.label).toBe("string");
      expect(lang.label.length).toBeGreaterThan(0);
    }
  });

  it("contains English", () => {
    expect(SUPPORTED_LANGUAGES.some((l) => l.code === "en")).toBe(true);
  });
});

// ─── DEFAULT_LOCALE ───────────────────────────────────────────────────────────

describe("DEFAULT_LOCALE", () => {
  it("is a non-empty string", () => {
    expect(typeof DEFAULT_LOCALE).toBe("string");
    expect(DEFAULT_LOCALE.length).toBeGreaterThan(0);
  });
});

// ─── EXTERNAL_LINKS ───────────────────────────────────────────────────────────

describe("EXTERNAL_LINKS", () => {
  it("solidProjectAbout is an https URL", () => {
    expect(EXTERNAL_LINKS.solidProjectAbout).toMatch(/^https:\/\//);
  });

  it("defaultGetPod is an https URL", () => {
    expect(EXTERNAL_LINKS.defaultGetPod).toMatch(/^https:\/\//);
  });
});

// ─── DEFAULT_FILE_TYPE_URI ────────────────────────────────────────────────────

describe("DEFAULT_FILE_TYPE_URI", () => {
  it("is a schema.org URI", () => {
    expect(DEFAULT_FILE_TYPE_URI).toMatch(/^http:\/\/schema\.org\//);
  });
});

// ─── FILE_TYPE_DESCRIPTION_MAX_LENGTH ─────────────────────────────────────────

describe("FILE_TYPE_DESCRIPTION_MAX_LENGTH", () => {
  it("is a positive number", () => {
    expect(typeof FILE_TYPE_DESCRIPTION_MAX_LENGTH).toBe("number");
    expect(FILE_TYPE_DESCRIPTION_MAX_LENGTH).toBeGreaterThan(0);
  });
});

// ─── APP_CONTAINER_PATH ───────────────────────────────────────────────────────

describe("APP_CONTAINER_PATH", () => {
  it("is a non-empty string ending with /", () => {
    expect(APP_CONTAINER_PATH.length).toBeGreaterThan(0);
    expect(APP_CONTAINER_PATH.endsWith("/")).toBe(true);
  });
});

// ─── SHARED_CATALOG_PREFIX ────────────────────────────────────────────────────

describe("SHARED_CATALOG_PREFIX", () => {
  it("is a non-empty string", () => {
    expect(SHARED_CATALOG_PREFIX.length).toBeGreaterThan(0);
  });
});

// ─── DEFAULT_CATALOG_FILENAME ─────────────────────────────────────────────────

describe("DEFAULT_CATALOG_FILENAME", () => {
  it("is a non-empty string", () => {
    expect(typeof DEFAULT_CATALOG_FILENAME).toBe("string");
    expect(DEFAULT_CATALOG_FILENAME.length).toBeGreaterThan(0);
  });

  it("ends with .ttl", () => {
    expect(DEFAULT_CATALOG_FILENAME.endsWith(".ttl")).toBe(true);
  });
});

// ─── SYSTEM_FILES ─────────────────────────────────────────────────────────────

describe("SYSTEM_FILES", () => {
  it("is a Set instance for efficient lookup of system filenames", () => {
    expect(SYSTEM_FILES instanceof Set).toBe(true);
  });

  it("contains catalog.ttl", () => {
    expect(SYSTEM_FILES.has("catalog.ttl")).toBe(true);
  });

  it("contains .acl", () => {
    expect(SYSTEM_FILES.has(".acl")).toBe(true);
  });
});

// ─── AVATAR_UPLOAD_PATH ───────────────────────────────────────────────────────

describe("AVATAR_UPLOAD_PATH", () => {
  it("is a non-empty string", () => {
    expect(AVATAR_UPLOAD_PATH.length).toBeGreaterThan(0);
  });
});

// ─── INDEX_FILE ───────────────────────────────────────────────────────────────

describe("INDEX_FILE", () => {
  it("is a non-empty string ending with .ttl", () => {
    expect(INDEX_FILE.length).toBeGreaterThan(0);
    expect(INDEX_FILE.endsWith(".ttl")).toBe(true);
  });
});

// ─── MAX_DISPLAY_NAME_LENGTH ──────────────────────────────────────────────────

describe("MAX_DISPLAY_NAME_LENGTH", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(MAX_DISPLAY_NAME_LENGTH)).toBe(true);
    expect(MAX_DISPLAY_NAME_LENGTH).toBeGreaterThan(0);
  });
});

// ─── STORAGE_RETRY_DELAY_MS ───────────────────────────────────────────────────

describe("STORAGE_RETRY_DELAY_MS", () => {
  it("is a positive number", () => {
    expect(STORAGE_RETRY_DELAY_MS).toBeGreaterThan(0);
  });
});

// ─── DATE_FORMAT_OPTIONS ──────────────────────────────────────────────────────

describe("DATE_FORMAT_OPTIONS", () => {
  it("includes month, day, year, hour, and minute", () => {
    expect(DATE_FORMAT_OPTIONS.month).toBeDefined();
    expect(DATE_FORMAT_OPTIONS.day).toBeDefined();
    expect(DATE_FORMAT_OPTIONS.year).toBeDefined();
    expect(DATE_FORMAT_OPTIONS.hour).toBeDefined();
    expect(DATE_FORMAT_OPTIONS.minute).toBeDefined();
  });

  it("produces a valid date string when used with Intl.DateTimeFormat", () => {
    const formatted = new Intl.DateTimeFormat("en-US", DATE_FORMAT_OPTIONS).format(new Date("2026-01-15T10:30:00Z"));
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});

// ─── SHORT_DATE_FORMAT_OPTIONS ────────────────────────────────────────────────

describe("SHORT_DATE_FORMAT_OPTIONS", () => {
  it("includes month, day, and year but not hour or minute", () => {
    expect(SHORT_DATE_FORMAT_OPTIONS.month).toBeDefined();
    expect(SHORT_DATE_FORMAT_OPTIONS.day).toBeDefined();
    expect(SHORT_DATE_FORMAT_OPTIONS.year).toBeDefined();
    expect(SHORT_DATE_FORMAT_OPTIONS.hour).toBeUndefined();
    expect(SHORT_DATE_FORMAT_OPTIONS.minute).toBeUndefined();
  });
});

// ─── RDF_NAMESPACES ───────────────────────────────────────────────────────────

describe("RDF_NAMESPACES", () => {
  it("every namespace value ends with # or /", () => {
    for (const [key, value] of Object.entries(RDF_NAMESPACES)) {
      expect(value.endsWith("#") || value.endsWith("/"), `${key} should end with # or /`).toBe(true);
    }
  });

  it("every namespace value is a valid URL", () => {
    for (const [key, value] of Object.entries(RDF_NAMESPACES)) {
      expect(() => new URL(value), `${key} is not a valid URL`).not.toThrow();
    }
  });

  it("includes the key namespaces used by the application", () => {
    expect(RDF_NAMESPACES.ACL).toContain("acl");
    expect(RDF_NAMESPACES.DCAT).toContain("dcat");
    expect(RDF_NAMESPACES.FOAF).toContain("foaf");
    expect(RDF_NAMESPACES.LDP).toContain("ldp");
    expect(RDF_NAMESPACES.SHACL).toContain("shacl");
  });
});

// ─── RDF_TYPE_URI ─────────────────────────────────────────────────────────────

describe("RDF_TYPE_URI", () => {
  it("equals the RDF namespace + 'type'", () => {
    expect(RDF_TYPE_URI).toBe(`${RDF_NAMESPACES.RDF}type`);
  });
});

// ─── CONTENT_TYPES ────────────────────────────────────────────────────────────

describe("CONTENT_TYPES", () => {
  it("TURTLE is text/turtle", () => {
    expect(CONTENT_TYPES.TURTLE).toBe("text/turtle");
  });

  it("N3 is text/n3", () => {
    expect(CONTENT_TYPES.N3).toBe("text/n3");
  });

  it("SPARQL_UPDATE is application/sparql-update", () => {
    expect(CONTENT_TYPES.SPARQL_UPDATE).toBe("application/sparql-update");
  });

  it("OCTET_STREAM is application/octet-stream", () => {
    expect(CONTENT_TYPES.OCTET_STREAM).toBe("application/octet-stream");
  });
});

// ─── MIME_PREFIXES ────────────────────────────────────────────────────────────

describe("MIME_PREFIXES", () => {
  it("IMAGE prefix matches image/ MIME types", () => {
    expect("image/jpeg".startsWith(MIME_PREFIXES.IMAGE)).toBe(true);
  });

  it("VIDEO prefix matches video/ MIME types", () => {
    expect("video/mp4".startsWith(MIME_PREFIXES.VIDEO)).toBe(true);
  });

  it("AUDIO prefix matches audio/ MIME types", () => {
    expect("audio/mpeg".startsWith(MIME_PREFIXES.AUDIO)).toBe(true);
  });

  it("TEXT prefix matches text/ MIME types", () => {
    expect("text/plain".startsWith(MIME_PREFIXES.TEXT)).toBe(true);
  });
});

// ─── SPREADSHEET_MIME_TYPES ───────────────────────────────────────────────────

describe("SPREADSHEET_MIME_TYPES", () => {
  it("is a non-empty array", () => {
    expect(SPREADSHEET_MIME_TYPES.length).toBeGreaterThan(0);
  });

  it("includes text/csv", () => {
    expect(SPREADSHEET_MIME_TYPES).toContain("text/csv");
  });

  it("includes application/vnd.ms-excel", () => {
    expect(SPREADSHEET_MIME_TYPES).toContain("application/vnd.ms-excel");
  });
});

// ─── DOCUMENT_MIME_TYPES ──────────────────────────────────────────────────────

describe("DOCUMENT_MIME_TYPES", () => {
  it("is a non-empty array", () => {
    expect(DOCUMENT_MIME_TYPES.length).toBeGreaterThan(0);
  });

  it("includes application/pdf", () => {
    expect(DOCUMENT_MIME_TYPES).toContain("application/pdf");
  });

  it("includes application/msword", () => {
    expect(DOCUMENT_MIME_TYPES).toContain("application/msword");
  });
});

// ─── DEFAULT_TBOX_PATH ────────────────────────────────────────────────────────

describe("DEFAULT_TBOX_PATH", () => {
  it("ends with .ttl", () => {
    expect(DEFAULT_TBOX_PATH.endsWith(".ttl")).toBe(true);
  });
});

// ─── FALLBACK_LANGUAGE ────────────────────────────────────────────────────────

describe("FALLBACK_LANGUAGE", () => {
  it("is a known language code in SUPPORTED_LANGUAGES", () => {
    expect(SUPPORTED_LANGUAGES.some((l) => l.code === FALLBACK_LANGUAGE)).toBe(true);
  });
});

// ─── SUPPORTED_LANGUAGE_CODES ─────────────────────────────────────────────────

describe("SUPPORTED_LANGUAGE_CODES", () => {
  it("is derived from SUPPORTED_LANGUAGES codes", () => {
    expect(SUPPORTED_LANGUAGE_CODES).toEqual(SUPPORTED_LANGUAGES.map((l) => l.code));
  });

  it("contains FALLBACK_LANGUAGE", () => {
    expect(SUPPORTED_LANGUAGE_CODES).toContain(FALLBACK_LANGUAGE);
  });
});

// ─── LANGUAGE_DETECTION_ORDER ─────────────────────────────────────────────────

describe("LANGUAGE_DETECTION_ORDER", () => {
  it("is a non-empty array", () => {
    expect(LANGUAGE_DETECTION_ORDER.length).toBeGreaterThan(0);
  });
});

// ─── LANGUAGE_CACHE_LOCATIONS ─────────────────────────────────────────────────

describe("LANGUAGE_CACHE_LOCATIONS", () => {
  it("is a non-empty array", () => {
    expect(LANGUAGE_CACHE_LOCATIONS.length).toBeGreaterThan(0);
  });
});

// ─── DEFAULT_FILE_TYPES ───────────────────────────────────────────────────────

describe("DEFAULT_FILE_TYPES", () => {
  it("is a non-empty array", () => {
    expect(DEFAULT_FILE_TYPES.length).toBeGreaterThan(0);
  });

  it("every entry has uri, id, label, description, and parentTypes", () => {
    for (const ft of DEFAULT_FILE_TYPES) {
      expect(typeof ft.uri).toBe("string");
      expect(ft.uri.startsWith("http://schema.org/")).toBe(true);
      expect(typeof ft.id).toBe("string");
      expect(ft.id.length).toBeGreaterThan(0);
      expect(typeof ft.label).toBe("string");
      expect(ft.label.length).toBeGreaterThan(0);
      expect(typeof ft.description).toBe("string");
      expect(Array.isArray(ft.parentTypes)).toBe(true);
    }
  });

  it("includes ImageObject, VideoObject, and AudioObject", () => {
    const ids = DEFAULT_FILE_TYPES.map((t) => t.id);
    expect(ids).toContain("ImageObject");
    expect(ids).toContain("VideoObject");
    expect(ids).toContain("AudioObject");
  });

  it("uri is consistent with RDF_NAMESPACES.SCHEMA + id", () => {
    for (const ft of DEFAULT_FILE_TYPES) {
      expect(ft.uri).toBe(`${RDF_NAMESPACES.SCHEMA}${ft.id}`);
    }
  });
});
