# Type Folder

## Overview

A collapsible folder that groups a contact's files by schema.org type, shown for files not yet explicitly shared with the viewer. Lets the viewer request access per file or for the entire group at once.

## Features

| Feature | Description |
|---|---|
| Request access | Each file row has a button that sends an LDP inbox notification to the contact |
| Request all | Folder level button sends access requests for every file in the group in one action |
| Request again | Rejected files show a badge and a retry button that deletes the old rejection before sending a new request |
| Status tracking | Each file and the bulk action independently track idle / sending / sent / error states |

## Hooks

| Hook | Purpose |
|---|---|
| `useAccessRequests` | Manages bulk and perfile request state, inbox discovery, and send/retry/delete operations |
