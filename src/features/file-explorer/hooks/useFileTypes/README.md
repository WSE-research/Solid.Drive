# useFileTypes

## Overview

Loads and caches file type definitions from the TBox ontology (`tbox.ttl`). Falls back to the default file types from `@/config` if loading fails.

Use this when you need the full list of types for a selector or display. To look up a single type by URI, use `getFileTypeInfo` from `@/infrastructure/validation/fileTypeRegistry` directly.

## Returns

| Value | Description |
|---|---|
| `fileTypes` | Array of all known file type definitions |
| `loading` | `true` while the TBox is being fetched |
| `error` | Error message string if the fetch failed, otherwise `null` |
| `loaded` | `true` once the TBox has been fetched at least once |
