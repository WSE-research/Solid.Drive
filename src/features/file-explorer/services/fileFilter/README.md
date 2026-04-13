# fileFilter

## Overview

Determines which leaf resources should be visible in the file explorer.

## Functions

| Function | Description |
|---|---|
| `isVisibleLeaf(entry)` | Returns `false` for files in the `SYSTEM_FILES` set (`catalog.ttl`, `robots.txt`, `.acl`, `.meta`, `README`) and shared catalog files matching the `.shared-*.ttl` pattern. Keeps the file browser clean without cluttering it with Pod plumbing files. |
