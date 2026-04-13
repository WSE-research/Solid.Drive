# ProfileCard

## Overview

Displays the logged-in user's avatar, display name, and WebID. Entering edit mode lets the user change their display name and upload a new avatar.

## Features

| Feature | Description |
|---|---|
| View profile | Shows avatar, display name, and WebID in read-only mode |
| Edit mode | Toggled via "Edit Profile" button; snapshot-and-restore on cancel |
| Name editing | Inline text input; saved via `useProfile.save` |
| Avatar upload | File picker uploads to `{storageRoot}public/avatar.{ext}` via `useProfile.uploadAvatar` |

## Hooks

| Hook | Purpose |
|---|---|
| `useProfile` | Owns name, imgUrl, displayName, isLoading, isUploadingAvatar, save, and uploadAvatar |
| `useNotifications` | Shows success and error toasts after save and avatar upload |
