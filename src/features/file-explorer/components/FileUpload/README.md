# File Upload

## Overview

Upload form for adding files to the user's Pod. Validates metadata against SHACL shapes before submit and keeps the button disabled until all required fields are filled.

## Upload sequence

| Step | Action |
|---|---|
| 1 | Creates a container for the file |
| 2 | Uploads the binary inside it |
| 3 | Writes `index.ttl` with DCAT metadata (title, publisher, MIME type, size, upload date) |
| 4 | Appends a DCAT dataset entry to `catalog.ttl` |
| 5 | Links the catalog to the user's profile (if not already linked) |

If any step after the binary upload fails, the newly created container is deleted so there is no orphaned data.

## Hooks

| Hook | Purpose |
|---|---|
| `useFileValidation` | Validates the selected file and metadata against SHACL shapes from `tbox.ttl` |
| `useFileUpload` | Handles the multi-step upload sequence and exposes an `isUploading` flag |
