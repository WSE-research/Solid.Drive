# useAclManager

## Overview

Manages WAC/ACL permissions for a specific file container. Handles granting and revoking access, syncing shared catalogs, and cleaning up legacy broader discovery access.

## Actions

| Action | Description |
|---|---|
| `loadAcl()` | Discovers the ACL URI, reads current grantees, syncs their shared catalogs, and removes legacy discovery access |
| `grant(contactWebId)` | Adds the contact to the container ACL, writes their shared catalog entry, and removes legacy discovery access |
| `revoke(contactWebId)` | Removes the contact from the ACL and deletes their entry from all candidate shared catalog files |

## Returns

| Value | Description |
|---|---|
| `aclUri` | Discovered ACL URI for the container (`null` until `loadAcl` completes) |
| `grantees` | WebIDs of contacts currently granted access |
| `loading` | `true` while `loadAcl` is in progress |
| `error` | Error message string if the last operation failed, otherwise `null` |
| `isSaving` | `true` while a `grant` or `revoke` is in progress |
| `loadAcl` | Loads current ACL state |
| `grant` | Grants access to a contact |
| `revoke` | Revokes access from a contact |
