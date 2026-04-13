# useDriveInitialization

## Overview

Composes `usePodDiscovery` and `useNavigation` to set up everything the file explorer needs on login: storage root, app container, navigation state, and the user's contact list.

## Features

| Feature | Description |
|---|---|
| Pod setup | Delegates to `usePodDiscovery` for storage root discovery and app container creation |
| Navigation state | Delegates to `useNavigation`; syncs initial URI and breadcrumb label once storage is discovered |
| Contact list | Reads the user's `foaf:knows` list and exposes it so `SharedWithMeSection` can load shared files |
| Storage retry | Exposes `handleRetryStorage` (from `usePodDiscovery`) for both manual and auto-retry |

## Returns

All values from `usePodDiscovery` and `useNavigation` are re-exported directly — see those READMEs for details.

| Value | Source |
|---|---|
| `appContainerUri`, `storageRootUri`, `noStorageDetected`, `handleRetryStorage` | [`usePodDiscovery`](../usePodDiscovery/README.md) |
| `currentUri`, `setCurrentUri`, `breadcrumbs`, `setBreadcrumbs`, `handleNavigate`, `handleBreadcrumbClick` | [`useNavigation`](../useNavigation/README.md) |
| `contacts` | WebIDs from the user's `foaf:knows` list |
