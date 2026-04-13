# useNavigation

## Overview

Manages the current folder URI and breadcrumb trail for the file explorer. Used internally by `useDriveInitialization`, which syncs the initial storage root into it once Pod discovery completes.

## Actions

| Action | Description |
|---|---|
| `handleNavigate(uri)` | Pushes a new folder onto the breadcrumb stack and sets it as the current URI |
| `handleBreadcrumbClick(index, uri)` | Jumps back to a previous location and trims the breadcrumb trail |
