# useFileSharing

## Overview

Checks whether a file container has been shared with other users. Discovers the container's ACL URI, reads the agents listed in it, and returns `true` if any non-owner agent has access. Used by `FileCard` to show the shared indicator badge.

Silently returns `false` if ACL discovery fails (e.g. the server does not support WAC).

## Returns

| Value | Description |
|---|---|
| `isShared` | `true` when at least one non-owner agent has access to the container |
