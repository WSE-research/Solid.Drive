# file-explorer

## Overview

The main file management feature. Lets users browse their Pod, upload files, download, share with contacts, and see files that contacts have shared with them.

## Contents

| Name | Description |
|---|---|
| **components/** | `FileExplorer` (root), `FileCard`, `FileUpload`, `FolderEntry`, `SharePanel`, `SharedWithMeSection`, `TypeFolder` |
| **hooks/** | Initialization, navigation, upload, validation, preview, sharing, pod discovery, file type loading, shared catalog resolution |
| **services/fileFilter** | Determines which files are visible vs. hidden (system files, shared catalogs) |

The feature is organized around the `FileExplorer` component, which coordinates navigation state and delegates rendering to the sub-components.
