# formatBytes

## Overview

`formatBytes(bytes: string | undefined): string` — formats a raw byte count (as a string) into a human-readable size.

## Returns

| Input | Output |
|---|---|
| Zero or undefined | `""` |
| Under 1 KB | `"512 B"` |
| Under 1 MB | `"1.5 KB"` |
| 1 MB or larger | `"2.3 MB"` |
