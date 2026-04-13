# useFilePreview

## Overview

Loads a binary Solid resource and returns an object URL for in-browser preview. Creates a blob URL with `URL.createObjectURL` and automatically revokes it on cleanup to prevent memory leaks.

## Returns

| Value | Description |
|---|---|
| `previewUrl` | Blob URL ready for use in `<img>`, `<video>`, or `<iframe>`, or `undefined` while loading |
