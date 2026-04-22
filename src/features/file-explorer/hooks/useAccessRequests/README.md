# useFileAccessRequests

## Overview

Manages the full lifecycle of sending file access requests to a contact's inbox. Tracks send status for individual files and for the entire type folder independently.

Status is tracked at two granularities — per-file and bulk. `handleRequestAll` synchronises both: it sets every entry in `fileStatuses` to `sending` at the start, then to `sent` on success or clears them on error. Individual `handleRequestFile` calls update only their own entry and leave `bulkStatus` untouched.

## Actions

| Action | Description |
|---|---|
| `handleRequestAll` | Discovers the contact's inbox once, then sends access request notifications for every entry in parallel |
| `handleRequestFile` | Sends an access request for a single file and updates that file's entry in `fileStatuses` |
| `handleRequestAgain` | Deletes the existing rejection message (best effort), clears the local badge, then sends a fresh request |

## Returns

| Value | Description |
|---|---|
| `bulkStatus` | `idle` / `sending` / `sent` / `error` for the group-level action |
| `fileStatuses` | Map of entry URI → `idle` / `sending` / `sent` / `error` for each individual file |
| `handleRequestAll` | Bulk request handler |
| `handleRequestFile` | Per-file request handler |
| `handleRequestAgain` | Retry handler after a rejection |
