# file-explorer/hooks

## Overview

React hooks for the file explorer feature.

## Contents

| Name | Description |
|---|---|
| **useAccessRequests** | Sends access requests to a contact's inbox for individual files or all files at once |
| **useDriveInitialization** | Discovers Pod storage, creates app container, sets up navigation state |
| **useFilePreview** | Creates a blob URL for previewing a binary resource; revokes on cleanup |
| **useFileSharing** | Checks if a resource has been shared (has non-owner ACL agents) |
| **useFileTypes** | Loads and caches file type definitions from `tbox.ttl` |
| **useFileUpload** | Executes the full upload sequence (container, binary, metadata, catalog) |
| **useFileValidation** | Validates upload form fields against SHACL shapes |
| **useNavigation** | Manages current folder URI and breadcrumb trail |
| **usePodDiscovery** | Finds `pim:storage` in the user's profile |
| **useSharedCatalog** | Resolves shared files from a contact's Pod |
