# types

## Overview

Shared TypeScript types used across features and infrastructure. Types live here instead of inside a specific feature or module because multiple unrelated layers depend on them — hoisting them to this package avoids circular imports.

## Contents

| File | Description |
|---|---|
| `index.ts` | Re-exports everything for convenience (`@/types`) |
| `solid.ts` | Resource capability interfaces (`LoadableResource`, `BinaryResource`, `DeletableResource`, etc.) and `FetchFn` |
| `catalog.ts` | `CatalogEntry` — the parsed DCAT dataset metadata shape returned by `parseCatalog` |
| `access.ts` | `AccessMode` — the WAC permission level union (`"Read" \| "Write" \| "Control"`) |
| `sharing.ts` | `SharedEntry` — the metadata snapshot passed from `FileCard` to the sharing layer when granting access |
