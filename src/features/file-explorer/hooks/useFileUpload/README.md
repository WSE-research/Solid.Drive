# useFileUpload

## Overview

Handles the full file upload sequence to a Solid Pod. Cleans up the created container on failure to avoid orphaned data.

## Upload sequence

| Step | Description |
|---|---|
| 1 | Creates a child container inside `mainContainer` |
| 2 | Uploads the binary file |
| 3 | Writes `index.ttl` with DCAT metadata (title, publisher, MIME type, size, upload date) |
| 4 | Appends a dataset entry to `catalog.ttl` |
| 5 | Links the catalog to the user's profile (if not already linked) |

## Returns

| Value | Description |
|---|---|
| `isUploading` | `true` while any step of the upload sequence is in progress |
| `upload` | Function that starts the upload sequence |
