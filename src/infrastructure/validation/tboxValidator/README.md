# tboxValidator

## Overview

Loads SHACL shapes from `tbox.ttl` and validates file metadata against them. Validation returns `{ valid, violations, shape }`. Each violation includes the property `path`, `label`, and `description` so the UI can show actionable error messages.

## Functions

| Function | Description |
|---|---|
| `loadTBox(tboxUri?, fetch?)` | Fetches, parses, and caches the TBox; returns `{ shapes, parents }` |
| `validateMetadata(metadata, typeUri, shapes, parents)` | Finds the shape for the type, walks the inheritance hierarchy (BFS with cycle detection), and checks required properties |
| `getShapeForType(typeUri, shapes, parents)` | Merges shape definitions from the type and all its ancestors |
| `resetTBoxCache()` | Clears cached shapes (used in tests) |
