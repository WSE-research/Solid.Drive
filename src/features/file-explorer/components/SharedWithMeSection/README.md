# Shared With Me Section

## Overview

Shows files that contacts have shared with the current user. For each contact in the user's `foaf:knows` list, tries per contact shared catalogs first, then falls back to the contact's main catalog.

## Features

| Behaviour | Description |
|---|---|
| Per contact catalogs | Checks `.shared-{webid}.ttl` files first |
| Type folders | Files not yet accessible are grouped by schema.org class and shown with request access buttons |
| Main catalog fallback | Falls back to the contact's main catalog when no per contact shared catalog exists |
| Rejection tracking | Reads the viewer's inbox for access rejections and exposes a dismiss action |
| Hidden when inaccessible | Renders nothing for a contact whose catalog cannot be reached |

## Hooks

| Hook | Purpose |
|---|---|
| `useSharedCatalog` | Resolves shared entries and type groups for a contact |
| `useContactRejections` | Fetches and manages file access rejection notifications |
