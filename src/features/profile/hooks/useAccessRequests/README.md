# Access Requests

## Overview

Lists, approves, and denies access requests from the user's LDP inbox. Loads requests on mount and on manual refresh.

## Actions

| Action | Description |
|---|---|
| Catalog approval | Creates a shared catalog, grants read access to it, the main catalog, and the app container listing |
| File approval | Grants read access directly to the file container |
| Denial | Sends a rejection notification to the requester's inbox before removing the message |

## Returns

| Field | Description |
|---|---|
| `requests` | Current list of access requests |
| `loading` | Boolean loading state |
| `error` | Error message or null |
| `busyMessageUri` | URI of the message currently being processed |
| `loadRequests` | Function to manually refresh the request list |
| `approve` | Function to approve a request |
| `deny` | Function to deny a request |

## Approve catalog request

```mermaid
sequenceDiagram
    title Approve Catalog Access Request
    actor User
    participant RP as RequestsPanel
    participant UAR as useAccessRequests
    participant ACL as aclManager
    participant IA as inboxAccess
    participant POD as Solid Pod

    User->>RP: click Approve (catalog)
    RP->>UAR: approve(request)
    activate UAR
    UAR->>POD: PUT sharedCatalog.ttl (empty)
    Note over UAR,ACL: secure shared catalog
    UAR->>ACL: discoverAclUri + writeResourceAcl(sharedCatalogUri, [requesterWebId])
    ACL->>POD: HEAD → PUT sharedCatalog.acl
    Note over UAR,ACL: grant read on main catalog
    UAR->>ACL: discoverAclUri + readAclAgents + writeResourceAcl(catalogUri, [requesterWebId])
    ACL->>POD: HEAD → GET → PUT catalog.acl
    Note over UAR,ACL: grant list-only on app container
    UAR->>ACL: discoverAclUri + writeListOnlyAcl(appContainerUri, [requesterWebId])
    ACL->>POD: HEAD → PUT appContainer.acl
    UAR->>IA: deleteAccessRequest(messageUri)
    IA->>POD: DELETE messageUri
    UAR-->>RP: requests updated
    deactivate UAR
```

## Approve file request

```mermaid
sequenceDiagram
    title Approve File Access Request
    actor User
    participant RP as RequestsPanel
    participant UAR as useAccessRequests
    participant ACL as aclManager
    participant IA as inboxAccess
    participant POD as Solid Pod

    User->>RP: click Approve (file)
    RP->>UAR: approve(request)
    activate UAR
    Note over UAR,ACL: grant read on file container
    UAR->>ACL: discoverAclUri + readAclAgents + writeAcl(fileContainerUri, [requesterWebId])
    ACL->>POD: HEAD → GET → PUT file.acl
    UAR->>IA: deleteAccessRequest(messageUri)
    IA->>POD: DELETE messageUri
    UAR-->>RP: requests updated
    deactivate UAR
```
