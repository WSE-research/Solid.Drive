# useContactRejections

## Overview

Fetches rejection notifications from a user's inbox and exposes a handler to dismiss individual entries. Used by both `SharedWithMeSection` (file-explorer) and `ContactsList` (profile).

## Returns

| Value | Description |
|---|---|
| `fileRejections` | Map of container URI → `AccessRejection` for all active rejections |
| `handleClearRejection(containerUri)` | Removes the rejection for the given URI from the local map |
