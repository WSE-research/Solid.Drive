# Profile Sidebar

## Overview

Layout container for the left sidebar. Assembles three panels in order and resolves the catalog URI from the user's profile to pass down to `RequestsPanel`.

## Layout

| Panel | Description |
|---|---|
| **ProfileCard** | Avatar + name with inline edit |
| **ContactsList** | Add/remove contacts, view rejection notices |
| **RequestsPanel** | Incoming access requests (only shown if catalog is available) |

Shown only when logged in — the `App` component conditionally renders this.
