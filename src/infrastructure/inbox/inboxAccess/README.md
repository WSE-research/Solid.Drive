# inbox Access

## Overview

High-level functions for working with Solid LDP inboxes. All message parsing and serialization is delegated to `inboxMessages`.

## Functions

| Function | Description |
|---|---|
| `discoverInboxUri(webId, fetch)` | Fetches a profile and extracts the `ldp:inbox` URI |
| `postCatalogAccessRequest(...)` | Sends a catalog level access request to a contact's inbox |
| `postFileAccessRequest(...)` | Sends a file level access request to a contact's inbox |
| `postRejectionNotification(...)` | Sends a denial notice to a requester's inbox |
| `listRejectionNotifications(...)` | Lists rejection messages in an inbox |
| `listAccessRequests(...)` | Lists access request messages in an inbox |
| `deleteAccessRequest(messageUri, fetch)` | Deletes an inbox message |
