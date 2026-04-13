# Requests Panel

## Overview

Collapsible panel for managing incoming access requests. Loads pending requests from the user's LDP inbox on open.

## Features

| Feature | Description |
|---|---|
| Approve (catalog) | Creates a per-viewer shared catalog, grants read access to it, the main catalog, and the app container. Deletes the inbox message on success |
| Approve (file) | Grants the requester read access to the specific file container. Deletes the inbox message on success |
| Deny | Sends a rejection notification to the requester's inbox, then deletes the message |
| Badge | Shows the count of pending requests on the toggle button |
| Requester profile | Each row shows the requester's avatar and display name via `RequesterRow` |

## Hooks

| Hook | Purpose |
|---|---|
| `useAccessRequests` | Loads inbox requests, tracks busy state, and handles approve/deny actions |

## Sequence

```mermaid
sequenceDiagram
    title Load Access Requests
    actor User
    participant RP as RequestsPanel
    participant UAR as useAccessRequests
    participant IA as inboxAccess
    participant POD as Solid Pod

    User->>RP: open panel
    RP->>UAR: loadRequests()
    UAR->>IA: discoverInboxUri(ownerWebId, fetch)
    IA->>POD: GET profile document
    POD-->>IA: inboxUri (from ldp:inbox triple)
    IA-->>UAR: inboxUri
    UAR->>IA: listAccessRequests(inboxUri, fetch)
    IA->>POD: GET inboxUri
    POD-->>IA: [messageUri, ...]
    loop for each message
        IA->>POD: GET messageUri
        POD-->>IA: AccessRequest (parsed from Turtle)
    end
    IA-->>UAR: AccessRequest[]
    UAR-->>RP: requests
```
