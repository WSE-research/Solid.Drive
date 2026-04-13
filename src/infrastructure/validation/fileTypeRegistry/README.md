# fileTypeRegistry

## Overview

Loads, caches, and queries schema.org file type definitions from the TBox ontology.

## Functions

| Function | Description |
|---|---|
| `loadFileTypes(tboxUri?)` | Fetches and parses `tbox.ttl`, caches the result |
| `getFileTypeInfo(uriOrId)` | Returns a `FileTypeDef` by URI or local ID |
| `getAllFileTypes()` | Returns all loaded types (falls back to defaults if not loaded) |
| `getFileTypesSync()` | Returns the cache synchronously (or `null` if not loaded yet) |
| `resolveClass(mimeType)` | Maps a MIME type to a schema.org class URI |
| `isKnownFileType(uriOrId)` | Returns true if the type is in the registry |
| `resetFileTypeCache()` | Clears the cache (used in tests) |

## MIME resolution order

| MIME pattern | Resolved class |
|---|---|
| `image/*` | `ImageObject` |
| `video/*` | `VideoObject` |
| `audio/*` | `AudioObject` |
| Spreadsheet MIME types | `SpreadsheetDigitalDocument` |
| Document types | `TextDigitalDocument` |
| Fallback | `DigitalDocument` |
