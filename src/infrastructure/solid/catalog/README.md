# catalog

## Overview

DCAT catalog operations for Solid pods. All communication is via raw `fetch` — no LDO. URIs passed to SPARQL operations are validated for unsafe characters before interpolation.

## Exports

| Name | Description |
|---|---|
| `resolveCatalogUri(profile, storageRoot)` | Returns `profile.catalog["@id"]` or falls back to `{storageRoot}catalog.ttl` |
| `appendToCatalog(...)` | Adds a dataset + distribution entry via SPARQL PATCH; auto-creates the catalog on 404 |
| `removeFromCatalog(...)` | Removes a dataset entry via SPARQL DELETE WHERE; no-ops if the catalog is not reachable |
| `parseCatalog(turtleText, baseUri?)` | Parses a Turtle catalog into `CatalogEntry[]` objects |
| `linkCatalogToProfile(catalogUri, webId, fetch)` | Adds a `dcat:catalog` triple to the user's profile document |
| `EMPTY_CATALOG_TURTLE` | Minimal Turtle template for creating a new empty catalog |
