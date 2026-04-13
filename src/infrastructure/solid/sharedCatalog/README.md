# sharedCatalog

## Overview

Helpers for the per-contact shared catalog naming scheme and access checks. Each file share creates a dedicated Turtle catalog at `.shared-{encodedViewerWebId}.ttl` inside the app container.

## Functions

| Function | Description |
|---|---|
| `getAppContainerUri(storageRoot)` | Returns `{storageRoot}my-solid-app/` |
| `getSharedCatalogUri(appContainerUri, viewerWebId)` | Full URI for a grantee-specific shared catalog |
| `getCandidateSharedCatalogUris(...)` | Returns both normalized and legacy filenames for backward compatibility |
| `isSharedCatalogFile(fileName)` | Returns `true` for `.shared-*.ttl` filenames |
| `toContainerUri(instanceUri)` | Converts `…/index.ttl` to `…/` |
| `hasAccess(containerUri, fetch)` | HEAD request to check if the viewer can read a container |
| `normalizeShareCatalogId(webId)` | Strips the `#fragment` from a WebID |
