/**
 * File type registry based on schema.org ontology definitions.
 *
 * @remarks
 * Loads and caches file type definitions from a TBox Turtle file,
 * providing lookups by URI or ID and MIME type resolution.
 *
 * @packageDocumentation
 */

import { Parser as N3Parser, Store as N3Store } from "n3";
import { 
  RDF_NAMESPACES, 
  DEFAULT_TBOX_PATH, 
  DEFAULT_FILE_TYPE_URI,
  FILE_TYPE_DESCRIPTION_MAX_LENGTH,
  DEFAULT_FILE_TYPES,
  MIME_PREFIXES,
  SPREADSHEET_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
} from "@/config";
import type { FetchFn } from "@/types";

const RDF = RDF_NAMESPACES.RDF;
const RDFS = RDF_NAMESPACES.RDFS;
const SCHEMA = RDF_NAMESPACES.SCHEMA;

/**
 * Represents a file type definition extracted from the TBox ontology.
 *
 * @public
 */
export interface FileTypeDef {
  /** Full URI of the type (e.g., "http://schema.org/ImageObject"). */
  uri: string;
  /** Local name / ID of the type (e.g., "ImageObject"). */
  id: string;
  /** Human-readable label from `rdfs:label`. */
  label: string;
  /** Description from `rdfs:comment`. */
  description: string;
  /** Parent types from `rdfs:subClassOf`. */
  parentTypes: string[];
}

let cachedFileTypes: FileTypeDef[] | null = null;
let cachedTypeMap: Map<string, FileTypeDef> | null = null;
let loadPromise: Promise<FileTypeDef[]> | null = null;

/**
 * Resets the file type cache.
 *
 * @remarks
 * Useful for testing or forcing a reload.
 *
 * @public
 */
export function resetFileTypeCache(): void {
  cachedFileTypes = null;
  cachedTypeMap = null;
  loadPromise = null;
}

/**
 * Gets cached file types synchronously.
 *
 * @remarks
 * Use {@link loadFileTypes} first to ensure types are loaded.
 *
 * @returns Cached file types, or null if not loaded yet
 *
 * @public
 */
export function getFileTypesSync(): FileTypeDef[] | null {
  return cachedFileTypes;
}

/**
 * Loads file types from the TBox TTL file.
 *
 * @remarks
 * Returns cached data if already loaded. Uses a shared promise
 * to prevent duplicate concurrent fetches.
 *
 * @param tboxUri - URI of the TBox file
 * @param fetchFn - Fetch function to use
 * @returns Array of file type definitions
 *
 * @public
 */
export async function loadFileTypes(
  tboxUri: string = DEFAULT_TBOX_PATH,
  fetchFn: FetchFn = fetch
): Promise<FileTypeDef[]> {
  if (cachedFileTypes) {
    return cachedFileTypes;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const response = await fetchFn(tboxUri);
    if (!response.ok) {
      throw new Error(`Failed to load TBox from ${tboxUri}: ${response.status} ${response.statusText}`);
    }

    const turtle = await response.text();
    const types = parseFileTypesFromTurtle(turtle);
    cachedFileTypes = types;
    cachedTypeMap = new Map(types.map((t) => [t.uri, t]));
    // Also index by ID for quick lookup
    for (const t of types) {
      cachedTypeMap.set(t.id, t);
    }
    return types;
  })();

  return loadPromise;
}

/**
 * Parses ALL schema.org class definitions from Turtle text.
 *
 * @remarks
 * Dynamically discovers all types — no hardcoded list.
 *
 * @param turtle - Raw Turtle content
 * @returns Array of parsed file type definitions
 *
 * @public
 */
export function parseFileTypesFromTurtle(turtle: string): FileTypeDef[] {
  let quads;
  try {
    quads = new N3Parser().parse(turtle);
  } catch {
    return getDefaultFileTypes();
  }

  const store = new N3Store(quads);
  const types: FileTypeDef[] = [];

  // Find ALL classes in the ontology (anything that is rdf:type rdfs:Class)
  const classQuads = store.getQuads(null, `${RDF}type`, `${RDFS}Class`, null);
  
  for (const quad of classQuads) {
    const uri = quad.subject.value;
    
    // Only include schema.org types
    if (!uri.startsWith(SCHEMA)) continue;

    // Extract local name (ID) from URI
    const id = uri.substring(SCHEMA.length);
    if (!id) continue;

    // Get label from rdfs:label
    const labelQuads = store.getObjects(uri, `${RDFS}label`, null);
    const label = labelQuads[0]?.value ?? humanizeId(id);

    // Get description from rdfs:comment
    const commentQuads = store.getObjects(uri, `${RDFS}comment`, null);
    let description = commentQuads[0]?.value ?? "";
    
    // Strip HTML tags from description
    description = description.replace(/<[^>]*>/g, "").trim();
    // Truncate long descriptions
    if (description.length > FILE_TYPE_DESCRIPTION_MAX_LENGTH) {
      description = description.substring(0, FILE_TYPE_DESCRIPTION_MAX_LENGTH - 3) + "...";
    }

    // Get parent types from rdfs:subClassOf
    const parentQuads = store.getObjects(uri, `${RDFS}subClassOf`, null);
    const parentTypes = parentQuads.map((p) => p.value);

    types.push({ uri, id, label, description, parentTypes });
  }

  // Sort alphabetically by label for consistent ordering
  types.sort((a, b) => a.label.localeCompare(b.label));

  // If we couldn't parse any types, return defaults
  if (types.length === 0) {
    return getDefaultFileTypes();
  }

  return types;
}

/**
 * Gets a file type definition by URI or ID.
 *
 * @param uriOrId - Full URI or local ID
 * @returns Matching file type, or undefined
 *
 * @public
 */
export function getFileType(uriOrId: string): FileTypeDef | undefined {
  if (cachedTypeMap) {
    const direct = cachedTypeMap.get(uriOrId);
    if (direct) return direct;
    // Try with schema.org prefix
    const withPrefix = cachedTypeMap.get(`${SCHEMA}${uriOrId}`);
    if (withPrefix) return withPrefix;
  }
  
  // Fallback to array search
  const types = cachedFileTypes ?? getDefaultFileTypes();
  return types.find(
    (t) => t.uri === uriOrId || t.id === uriOrId || t.uri.endsWith(`/${uriOrId}`)
  );
}

/**
 * Checks if a URI or ID is a known file type.
 *
 * @param uriOrId - Full URI or local ID
 * @returns True if the type is registered
 *
 * @public
 */
export function isKnownFileType(uriOrId: string): boolean {
  return getFileType(uriOrId) !== undefined;
}

/**
 * Gets the friendly label for a file type.
 *
 * @param uriOrId - Full URI or local ID
 * @returns Human-readable label
 *
 * @public
 */
export function getFileTypeLabel(uriOrId: string): string {
  const typeDef = getFileType(uriOrId);
  if (typeDef) return typeDef.label;
  // Fallback: extract local name from URI
  return uriOrId.split(/[#/]/).pop() ?? uriOrId;
}

/**
 * Gets label and description for a file type.
 *
 * @param uriOrId - Full URI or local ID
 * @returns Object with label and description
 *
 * @public
 */
export function getFileTypeInfo(uriOrId: string): { label: string; description: string } {
  const typeDef = getFileType(uriOrId);
  if (typeDef) return { label: typeDef.label, description: typeDef.description };
  const fallback = uriOrId.split(/[#/]/).pop() ?? uriOrId;
  return { label: fallback, description: "" };
}

/**
 * Gets the full URI for a file type ID.
 *
 * @param id - Local ID of the file type
 * @returns Full URI, defaulting to `schema:DigitalDocument`
 *
 * @public
 */
export function getFileTypeUri(id: string): string {
  const typeDef = getFileType(id);
  return typeDef?.uri ?? `${SCHEMA}DigitalDocument`;
}

/**
 * Gets all loaded file types.
 *
 * @returns Array of all file type definitions
 *
 * @public
 */
export function getAllFileTypes(): FileTypeDef[] {
  return cachedFileTypes ?? getDefaultFileTypes();
}

/**
 * Resolves a MIME type to its corresponding schema.org class URI.
 *
 * @remarks
 * Maps common media types (image, video, audio) and document types
 * to their appropriate schema.org classifications.
 *
 * @param contentType - MIME type string
 * @returns schema.org class URI
 *
 * @public
 */
export function resolveClass(contentType: string): string {
  const imageType = getFileTypeUri("ImageObject");
  const videoType = getFileTypeUri("VideoObject");
  const audioType = getFileTypeUri("AudioObject");
  const spreadsheetType = getFileTypeUri("SpreadsheetDigitalDocument");
  const textType = getFileTypeUri("TextDigitalDocument");

  if (contentType.startsWith(MIME_PREFIXES.IMAGE)) return imageType;
  if (contentType.startsWith(MIME_PREFIXES.VIDEO)) return videoType;
  if (contentType.startsWith(MIME_PREFIXES.AUDIO)) return audioType;
  if (SPREADSHEET_MIME_TYPES.includes(contentType as typeof SPREADSHEET_MIME_TYPES[number])) return spreadsheetType;
  if (
    contentType.startsWith("text/") ||
    DOCUMENT_MIME_TYPES.includes(contentType as typeof DOCUMENT_MIME_TYPES[number])
  ) return textType;
  return DEFAULT_FILE_TYPE_URI;
}

/**
 * Default file types as fallback when TTL cannot be parsed.
 *
 * @returns Mutable copy of the defaults from config
 *
 * @internal
 */
function getDefaultFileTypes(): FileTypeDef[] {
  return DEFAULT_FILE_TYPES.map((t) => ({ ...t }));
}

/**
 * Converts a camelCase or PascalCase ID to a human-readable label.
 *
 * @param id - The identifier to humanize
 * @returns Spaced, title-cased label
 *
 * @internal
 */
function humanizeId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
