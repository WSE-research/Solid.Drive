# resourceGuards

## Overview

Type guard functions for narrowing LDO resource types. LDO exposes resource capabilities through method presence (duck typing) rather than a class hierarchy. These guards make it safe to call those methods.

## Functions

| Function | Description |
|---|---|
| `isLoadable(r)` | Checks `isLoading`, `isUnfetched`, `isFetched` methods |
| `isReadable(r)` | Checks `isReading` method |
| `isBinary(r)` | Checks `isBinary` + `getBlob` methods |
| `isDeletable(r)` | Checks `delete` method |
| `isReloadable(r)` | Checks `reload` method |
| `isSolidContainer(r)` | Checks `children` function |
| `isSolidLeaf(r)` | Checks `type === "SolidLeaf"` property |
