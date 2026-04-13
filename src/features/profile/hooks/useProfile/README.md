# useProfile

## Overview

Reads and writes the logged-in user's profile fields (`foaf:name`, `foaf:img`). Syncs local state from the LDO-subscribed profile on each render (unless `suspendSync` is true, which prevents the form from being reset mid-edit).

## Returns

| Value | Description |
|---|---|
| `name` | Current editable name (local state, synced from profile) |
| `imgUrl` | Current editable avatar URL (local state, synced from profile) |
| `displayName` | Read-only display name from `foaf:name` or `foaf:fn` |
| `isLoading` | `true` while the profile resource is loading |
| `isUploadingAvatar` | `true` while an avatar PUT is in progress |
| `setName` | Setter for `name` |
| `setImgUrl` | Setter for `imgUrl` |
| `save(original)` | Patches the profile with N3 Solid Patch then reloads the resource |
| `uploadAvatar(file)` | PUTs the file to `{storageRoot}public/avatar.{ext}` and updates `imgUrl` on success |
| `reload` | Reloads the profile resource |
