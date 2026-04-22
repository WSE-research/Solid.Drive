# useSharedCatalog

## Overview

Resolves which files a contact has shared with the current user. Tries per-contact shared catalogs first, then falls back to the contact's main catalog.

## Resolution strategy

| Step | Description |
|---|---|
| Per-contact catalog | Fetches `.shared-{viewerWebId}.ttl` from the contact's app container |
| Access check | For entries in the main catalog not in the shared catalog, does a HEAD request to see if the viewer can read them |
| Main catalog fallback | Falls back to the contact's main `catalog.ttl` when no per-contact catalog exists; performs the same HEAD-based access checks and populates `typeGroups` for inaccessible entries |

## Returns

| Value | Description |
|---|---|
| `sharedEntries` | Files explicitly shared or confirmed accessible via HEAD check |
| `typeGroups` | Files not yet accessible, grouped by schema.org class for the `TypeFolder` component |
| `resolvedCatalogUri` | URI of whichever catalog was successfully read |
| `catalogAccessible` | `true` when at least one catalog was reachable |
| `isProfileLoading` | `true` while the contact's Solid profile is still loading |
