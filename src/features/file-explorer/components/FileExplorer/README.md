# File Explorer

## Overview

Root component of the file explorer feature. Coordinates everything: Pod discovery, navigation, file listing, upload, and shared files.

## Features

+ **Pod setup** — on mount discovers the user's Pod storage root and creates `my-solid-app/` if needed
+ **Breadcrumb navigation** — push on navigate, trim on breadcrumb click
+ **File listing** — folders as `FolderEntry`, app-managed files as `FileCard`
+ **Upload** — delegates to `FileUpload`
+ **Refresh** — reloads the current container from the Pod
+ **Shared files** — renders `SharedWithMeSection` below the main browser

Shows a login prompt, no-storage error, or connecting spinner before the main UI is ready.

## Hooks

| Hook | Purpose |
|---|---|
| `useDriveInitialization` | Discovers the Pod storage root, creates the app container, and manages breadcrumb navigation state |
