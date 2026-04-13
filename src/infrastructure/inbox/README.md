# inbox

## Overview

Handles Solid LDP inbox operations for access request messaging.

## Contents

| Name | Description |
|---|---|
| **inboxAccess** | High-level functions: discover inbox URI, post requests/rejections, list and delete messages |
| **inboxMessages** | Low-level: parse Turtle messages, build Turtle message bodies, extract contained resource URIs |

## Message types

| Type | Description |
|---|---|
| `solid-access:CatalogAccessRequest` | Catalog-level sharing request |
| `solid-access:FileAccessRequest` | Request to access a specific file |
| `solid-access:AccessRejected` | Denial notification |
