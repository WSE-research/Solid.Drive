# features

## Overview

UI features, each self-contained in its own folder with components, hooks, and services. Features may import from `@/infrastructure` and `@/shared`. Cross-feature imports are not allowed except that `file-explorer` imports from `sharing` (WAC hooks).

## Contents

| Feature | Description |
|---|---|
| `auth/` | Login/logout, provider selection, language switching |
| `file-explorer/` | Browse Pod files, upload, download, share, navigate folders |
| `profile/` | View and edit user profile, manage contacts, handle access requests |
| `sharing/` | Low-level WAC ACL hooks; consumed by `file-explorer/SharePanel` |
