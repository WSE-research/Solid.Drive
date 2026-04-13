# file-explorer/components

## Overview

UI components for the file explorer feature.

## Contents

| Name | Description |
|---|---|
| **FileExplorer** | Root coordinator: navigation state, breadcrumbs, file listing, upload, shared files section |
| **FileCard** | Displays a single uploaded file: preview, metadata, info panel, share panel, delete |
| **FileUpload** | Upload form with TBox validation; creates container, writes binary + `index.ttl`, updates catalog |
| **FolderEntry** | Clickable row for navigating into a Pod container that is not managed by this app |
| **SharePanel** | Grant/revoke per-file access to contacts via WAC ACLs and shared catalogs |
| **SharedWithMeSection** | Shows files shared by contacts; reads per contact shared catalogs and checks accessibility |
| **TypeFolder** | Collapsible folder grouped by schema.org type, with request access buttons per file |
