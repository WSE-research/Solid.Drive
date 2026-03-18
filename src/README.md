# src

## Module map

```
App.tsx
 └── Header.tsx          auth (login/logout, display name)
 └── FileExplorer.tsx    navigation + data loading
      ├── FileUpload.tsx  upload form → Pod write sequence
      ├── FileCard.tsx    file display, preview, info, delete
      └── FolderEntry.tsx navigable row for non-app folders

pod.ts            LDO type guards (isSolidContainer, isBinary, …)
podCatalog.ts     catalog CRUD via SPARQL (appendToCatalog, removeFromCatalog, …)
useCatalogUri.ts  resolve catalog URI from profile or storage root
tboxValidator.ts  load tbox.ttl, parse SHACL shapes, validate upload metadata
generateShape.ts  inspect unknown Turtle data and infer RDF shapes
```

---

## Components

### `App.tsx`

Wraps the tree in `BrowserSolidLdoProvider`. Required — without it no component can access the Solid session or LDO hooks. When logged in, renders `ProfileSidebar` on the left alongside the main `FileExplorer`.

### `Header.tsx`

Login/logout bar. Presents a provider dropdown (`solidcommunity.net`, `inrupt.net`, `solidweb.org`, custom URL) with registration links per provider. When logged in, resolves and displays the user's name from their Solid profile (`vcard:fn` → `foaf:name` → WebID fallback).

### `ProfileSidebar.tsx`

Social identity on Solid is more than a display name, it includes a live contact graph (`foaf:knows`) that links one WebID to others across different pods. `ProfileSidebar` is where the app exposes that: it reads the logged-in user's WebID profile document via LDO and lets them edit their name, avatar, and contacts without leaving the app.

Every write goes through N3 Patch (`solid:InsertDeletePatch`), not SPARQL UPDATE, because NSS does not support SPARQL UPDATE on profile documents. Contact profiles are fetched per-row by `ContactRow`; it strips the `#fragment` from the WebID before requesting the document because the document lives at the base IRI, the fragment identifies the person within it, not a separate resource.

### `ProfileSidebar.tsx`

Social identity on Solid is more than a display name, it includes a live contact graph (`foaf:knows`) that links one WebID to others across different pods. `ProfileSidebar` is where the app exposes that: it reads the logged-in user's WebID profile document via LDO and lets them edit their name, avatar, and contacts without leaving the app.

Every write goes through N3 Patch (`solid:InsertDeletePatch`), not SPARQL UPDATE, because NSS does not support SPARQL UPDATE on profile documents. Contact profiles are fetched per-row by `ContactRow`; it strips the `#fragment` from the WebID before requesting the document because the document lives at the base IRI, the fragment identifies the person within it, not a separate resource.

### `FileExplorer.tsx`

Central coordinator. On first render it resolves the storage root from the session profile and creates `my-solid-app/` if it doesn't exist yet. From then on it manages:

- **Current container URI** and **breadcrumb trail** — `handleNavigate` pushes a new crumb, `handleBreadcrumbClick` trims back to any previous level
- **Rendering strategy** — inside `my-solid-app/` it renders a `FileCard` per sub-container; anywhere else it renders a `FolderEntry` per sub-container and a download button per leaf file
- **Catalog URI** — resolved via `resolveCatalogUri` and passed down to `FileUpload` and `FileCard`
- **Refresh** — `handleReload` reloads the current container from the Pod

System files (`catalog.ttl`, `robots.txt`, `README`, `.acl`, `.meta`) are filtered from the leaf file list.

### `FileUpload.tsx`

Executes the upload sequence (see root README for the full flow). Key implementation details:

<<<<<<< HEAD
- **TBox validation** — `loadTBox()` is called on mount; the resulting shapes are used by `validateMetadata()` on every form change. The submit button stays disabled until all required fields (`name`, `uploadDate`, `publisher`) are present. `name` maps to the visible title input; `uploadDate` and `publisher` are auto-populated and surface as non-actionable violations if missing.
- `resolveClass(mimeType)` from `podCatalog.ts` converts the MIME type to a schema.org class URI before the container is created
- Filenames are sanitized to lowercase alphanumeric + hyphens before upload (`safeFileName`) so NSS does not reject PUT requests for filenames with special characters
- `profileHasCatalog` (passed from `FileExplorer`) prevents adding a duplicate `dcat:catalog` triple when the user already has one from another app
- Rollback on failure: if any step after the binary upload throws, the container is deleted via raw `fetch` calls before surfacing the error
=======
```
resolve schema.org class from MIME type
  → sanitize filename
    → create container (e.g. my-solid-app/photo-001/)
      → upload binary (photo.jpg)
        → write index.ttl (file metadata as Linked Data)
          → append entry to catalog.ttl
            → link catalog to profile (only on first upload)
```

Filenames are sanitized to lowercase alphanumeric + hyphens before upload (`safeFileName`) so that NSS does not reject PUT requests for filenames with special characters. If any step after the binary upload fails, the entire container is deleted so no half-written resources are left on the Pod. The `profileHasCatalog` prop prevents overwriting a user's custom catalog pointer with a second `dcat:catalog` triple.
>>>>>>> 4ba3623 (feat: represent user identity and social connections using FOAF)

### `FileCard.tsx`

Displays one uploaded file. It reads `index.ttl` with `useSubject` to get the metadata, locates the binary inside the same container, and renders it inline — as `<img>`, `<video>`, `<audio>`, or `<iframe>` depending on MIME type. The publisher's WebID is resolved to a display name by loading their Solid profile.

The **Info panel** (toggled with a button) shows: type, title, description, format, size, upload date, last modified date, publisher name, and `isPartOf` URI.

**Delete** calls `removeFromCatalog` first (removes the DCAT entry), then deletes the container (which removes the binary and `index.ttl`).

### `FolderEntry.tsx`

A navigable row for Pod containers that are not managed by this app. Kept separate from `FileCard` because it cannot assume `index.ttl` or any app-specific metadata exists.

---

### `DataCatalog.tsx`

Opens as a modal, fetches `catalog.ttl` fresh on each open, and shows the 2 most recent uploads sorted by `dcterms:modified`. Composed of `TBoxView` and `ABoxView`.

---

## `useCatalogUri.ts`

- **`resolveCatalogUri(profile, storageRoot)`** — returns the catalog URI. Checks `profile.catalog["@id"]` first; falls back to `${storageRoot}catalog.ttl`.

---

## `foaf.ts`

Isolated write layer for FOAF profile edits. Keeping patch logic here rather than inside the component means there is one place to change if the server changes or if you want to extend what the app writes to the profile.

`saveProfileFields` replaces `foaf:name` and `foaf:img` in a single PATCH — combining both fields into one request avoids a window where another client could read the profile between two separate writes. `ensureProfileDocType` adds the `foaf:PersonalProfileDocument` and `foaf:primaryTopic` declarations on first edit; NSS-created profiles sometimes omit them, and some Solid clients require these types to recognise the document as a profile.

## `podCatalog.ts`

All catalog and file-type logic. No direct LDO usage — communicates with the Pod via raw `fetch`.

## `foaf.ts`

Isolated write layer for FOAF profile edits. Keeping patch logic here rather than inside the component means there is one place to change if the server changes or if you want to extend what the app writes to the profile.

`saveProfileFields` replaces `foaf:name` and `foaf:img` in a single PATCH — combining both fields into one request avoids a window where another client could read the profile between two separate writes. `ensureProfileDocType` adds the `foaf:PersonalProfileDocument` and `foaf:primaryTopic` declarations on first edit; NSS-created profiles sometimes omit them, and some Solid clients require these types to recognise the document as a profile.

- **`resolveClass(mimeType)`** — maps a MIME type to a schema.org class URI. Spreadsheet types are matched before the generic `text/*` wildcard to avoid misclassification.

- **`friendlyLabel(uriOrId)`** — accepts a full schema.org URI or local ID (e.g. `ImageObject`) and returns the display label (e.g. `Photo/Image`).

- **`appendToCatalog(catalogUri, ...)`** — creates `catalog.ttl` with a SPARQL `PUT` if it doesn't exist, then `PATCH`es it with `INSERT DATA` to add a `dcat:Dataset` node and a linked `dcat:Distribution` (access URL, media type, byte size).

- **`removeFromCatalog(catalogUri, instanceUri, fetch)`** — `PATCH`es `catalog.ttl` with `DELETE WHERE` to remove the dataset and its distribution node in one request. Silently returns if the catalog doesn't exist.

- **`linkCatalogToProfile(catalogUri, webId, fetch)`** — adds a `dcat:catalog` triple to the WebID profile document so external agents can discover the catalog. Only called on first upload (guarded by `profileHasCatalog` in `FileUpload`).

- **`parseCatalog(turtleText)`** — parses a `catalog.ttl` Turtle string into `CatalogEntry` objects. Used in tests and tooling.

- **`friendlyLabel(uriOrId)`** — converts a TBox class URI into a readable class label (e.g., `ImageFile` → `Photo/Image`).

---

## `pod.ts`

Type guards that narrow LDO resource union types. LDO exposes capabilities via method presence rather than a class hierarchy, so these guards use duck-typing.

| Guard | Checks for |
|---|---|
| `isLoadable` | `isLoading` method |
| `isReadable` | `isReading` method |
| `isBinary` | `isBinary` + `getBlob` methods |
| `isDeletable` | `delete` method |
| `isReloadable` | `reload` method |
| `isSolidContainer` | `children` function |
| `isSolidLeaf` | `type === "SolidLeaf"` property |

**Helper:** `formatBytes(bytes)` — formats a byte count string into a readable size (e.g. `"1.2 MB"`).

---

## `tboxValidator.ts`

Loads, parses, and queries the SHACL TBox served at `/tbox.ttl` (auto-generated from datashapes.org by `scripts/extract-tbox.mjs`).

- **`loadTBox(tboxUri?, fetchFn?)`** — fetches `tbox.ttl`, delegates to `parseTBox`, and caches the result. Returns `{ shapes, parents }`. Subsequent calls return the cache.

- **`parseTBox(turtle)`** — pure parsing function (no I/O). Reads all `sh:NodeShape` declarations and `rdfs:subClassOf` relations from the Turtle string. Returns `shapes: Map<uri, ShapeDefinition>` and `parents: Map<child, parent[]>`.

- **`getShapeForType(typeUri, shapes, parents)`** — walks the `rdfs:subClassOf` chain with BFS, collects all applicable `ShapeDefinition`s, and merges their properties. Required properties always win over optional ones; first occurrence wins within each category.

- **`validateMetadata(metadata, typeUri, shapes, parents)`** — calls `getShapeForType`, then checks each `requiredProperty` against the metadata object. Matches by local name (e.g. `"name"`) or full URI. Returns `{ valid, violations, shape }`.

- **`resetTBoxCache()`** — clears the module-level cache so the next `loadTBox` call fetches fresh data (used in tests).

Exported interfaces: `PropertyConstraint`, `ShapeDefinition`, `ValidationResult`, `PropertyViolation`.

---

## `generateShape.ts`

Utility for discovering RDF shapes from Turtle data. Parses Turtle with N3, aggregates subjects by `rdf:type`, and returns `DiscoveredShape[]` — each with a type name and a list of observed properties, value types, and occurrence counts. Useful for inspecting unknown Pod data or checking that generated shapes match real data.

- **`discoverShapesFromTurtle(turtleText)`**

---

## Data shapes

`.shapes/` defines the data contracts; `.ldo/` holds the auto-generated TypeScript bindings. See [.shapes/README.md](.shapes/README.md) for field details and the build command.
