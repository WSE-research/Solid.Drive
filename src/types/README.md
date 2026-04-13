# types

## Overview

Shared TypeScript types used across features and infrastructure.

## Contents

+ `index.ts` — reexports everything for convenience (`@/types`)
+ `solid.ts` — resource capability interfaces (`LoadableResource`, `BinaryResource`, `DeletableResource`, etc.) and `FetchFn`
+ `catalog.ts` — `CatalogEntry` (parsed DCAT dataset metadata)
+ `access.ts` — `ProfileFields` and other access related types

These types sit here rather than in specific modules because multiple layers (features, infrastructure, hooks) depend on them.
