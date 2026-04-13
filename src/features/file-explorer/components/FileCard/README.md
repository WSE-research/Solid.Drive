# File Card

## Overview

Displays a single uploaded file and its metadata. Reads `index.ttl` from the file's container via LDO, resolves the binary resource, and renders a preview depending on MIME type. Also resolves the publisher's WebID to a display name.

## Features

| Action | Description |
|---|---|
| Info | Toggles a panel with type, size, upload date, modified date, publisher |
| Share | Opens `SharePanel` to grant / revoke access |
| Download | Links directly to the binary |
| Delete | Removes the DCAT entry from the catalog, then deletes the container |

Pass `readOnly` to hide mutation controls (used by `SharedWithMeSection` for files you don't own).

## Hooks

| Hook | Purpose |
|---|---|
| `useFileSharing` | Checks whether the file container has an ACL granting access to others |
| `useFilePreview` | Resolves a blob URL for in-browser preview of the binary |
