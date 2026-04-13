# usePodDiscovery

## Overview

Discovers the user's Pod storage root from their Solid profile (`pim:storage`). Runs once after login, creates the app container (`my-solid-app/`) if it does not already exist, and exposes a retry handler for when no storage is found.

Used internally by `useDriveInitialization`. Use it directly when you only need the storage root without navigation state or contacts.

## Returns

| Value | Description |
|---|---|
| `appContainerUri` | URI of the `my-solid-app/` container |
| `storageRootUri` | Root URI of the user's Pod storage |
| `noStorageDetected` | `true` when no `pim:storage` triple was found on the profile |
| `handleRetryStorage` | Reloads the profile resource and resets discovery state; also called automatically after `storageRetryDelayMs` |
| `initialCurrentUri` | Storage root URI to use as the navigation starting point |
| `initialBreadcrumbLabel` | Translated label for the root breadcrumb entry |
