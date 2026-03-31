# src

## Module map

```text
App.tsx
 `-- Header.tsx               auth (login/logout, display name, language)
     `-- FileExplorer.tsx     navigation + data loading
         |-- FileUpload.tsx   upload form -> Pod write sequence
         |-- FileCard.tsx     file display, preview, info, share, delete
         |-- SharePanel.tsx   grant / revoke access
         |-- SharedWithMeSection.tsx shared file discovery
         `-- FolderEntry.tsx  navigable row for non-app folders

pod.ts            LDO type guards (isSolidContainer, isBinary, ...)
podCatalog.ts     catalog CRUD via SPARQL (appendToCatalog, removeFromCatalog, ...)
fileAccess.ts     ACL discovery, parsing, and writes
shareCatalog.ts   shared catalog naming and lookup helpers
useCatalogUri.ts  resolve catalog URI from profile or storage root
tboxValidator.ts  load tbox.ttl, parse SHACL shapes, validate upload metadata
generateShape.ts  inspect unknown Turtle data and infer RDF shapes
```

---

## Components

### `App.tsx`

Root component. Wraps the tree in `BrowserSolidLdoProvider`, which manages the Solid session and exposes LDO hooks to every child. Nothing below this can authenticate or read Pod data without it.

### `Header.tsx`

Top-level authentication bar for login and logout. The provider dropdown lets users choose their identity provider, since Solid uses decentralized Pods instead of a single identity server. Also renders `LanguageSwitcher` in both the logged-in and logged-out states.

### `LanguageSwitcher.tsx`

Dropdown that lets users switch the UI language at runtime. Supported languages: English, German. Uses `i18next`'s `changeLanguage` under the hood.

### `FileExplorer.tsx`

Central coordinator. On first render it resolves the storage root from the session profile and creates `my-solid-app/` if it doesn't exist yet. From then on it manages:

- **Current container URI** and **breadcrumb trail** — `handleNavigate` pushes a new crumb, `handleBreadcrumbClick` trims back to any previous level
- **Rendering strategy** — inside `my-solid-app/` it renders a `FileCard` per sub-container; anywhere else it renders a `FolderEntry` per sub-container and a download button per leaf file
- **Catalog URI** — resolved via `resolveCatalogUri` and passed down to `FileUpload` and `FileCard`
- **Shared file discovery** — reads contacts from the user's profile and renders `SharedWithMeSection` below the main browser
- **Refresh** — `handleReload` reloads the current container from the Pod

System files (`catalog.ttl`, `robots.txt`, `README`, `.acl`, `.meta`) and shared catalog files (`.shared-*.ttl`) are filtered from the leaf file list.

### `FileUpload.tsx`

Executes the upload sequence (see root README for the full flow). Key implementation details:

- **TBox validation** — `loadTBox()` is called on mount; the resulting shapes are used by `validateMetadata()` on every form change. The submit button stays disabled until all required fields (`name`, `uploadDate`, `publisher`) are present. `name` maps to the visible title input; `uploadDate` and `publisher` are auto-populated and surface as non-actionable violations if missing.
- `resolveClass(mimeType)` from `podCatalog.ts` converts the MIME type to a schema.org class URI before the container is created
- `profileHasCatalog` (passed from `FileExplorer`) prevents adding a duplicate `dcat:catalog` triple when the user already has one from another app
- Rollback on failure: if any step after the binary upload throws, the container is deleted via raw `fetch` calls before surfacing the error

### `FileCard.tsx`

Displays one uploaded file. It reads `index.ttl` with `useSubject` to get the metadata, locates the binary inside the same container, and renders it inline — as `<img>`, `<video>`, `<audio>`, or `<iframe>` depending on MIME type. The publisher's WebID is resolved to a display name by loading their Solid profile.

The **Info panel** (toggled with a button) shows: type, title, description, format, size, upload date, last modified date, publisher name, and `isPartOf` URI.

Owned files render a **Share** toggle and **Delete** button. Shared files rendered through `SharedWithMeSection` pass `readOnly`, which hides mutation controls and suppresses incomplete metadata cards that cannot be rendered safely.

**Delete** calls `removeFromCatalog` first (removes the DCAT entry), then deletes the container (which removes the binary and `index.ttl`).

### `SharePanel.tsx`

Manages per-file sharing for owned files. It reads the file container ACL, lists current grantees, and lets the user grant or revoke access for contacts from their profile.

On grant, it:

- updates the container ACL with `writeAcl`
- mirrors the file's DCAT entry into the grantee-specific shared catalog
- writes a resource ACL for that shared catalog so only the intended contact can read it
- removes legacy broader discovery access where possible without blocking the current share action

On revoke, it removes the contact from the file container ACL and deletes the mirrored dataset entry from every candidate shared catalog filename for that contact.

### `SharedWithMeSection.tsx`

Renders files shared by contacts in the user's Solid profile. For each contact it:

- resolves the contact's storage root
- tries per-contact shared catalogs first
- falls back to the contact's main catalog so older shares still show up
- parses catalog entries into `FileCard` instances rendered in read-only mode

### `FolderEntry.tsx`

A navigable row for Pod containers that are not managed by this app. Kept separate from `FileCard` because it cannot assume `index.ttl` or any app-specific metadata exists.

---

## `useCatalogUri.ts`

- **`resolveCatalogUri(profile, storageRoot)`** — returns the catalog URI. Checks `profile.catalog["@id"]` first; falls back to `${storageRoot}catalog.ttl`.

---

## `podCatalog.ts`

All catalog and file-type logic. No direct LDO usage — communicates with the Pod via raw `fetch`.

- **`resolveClass(mimeType)`** — maps a MIME type to a schema.org class URI. Spreadsheet types are matched before the generic `text/*` wildcard to avoid misclassification.
- **`friendlyLabel(uriOrId)`** — accepts a full schema.org URI or local ID (e.g. `ImageObject`) and returns the display label (e.g. `Photo/Image`).
- **`appendToCatalog(catalogUri, ...)`** — tries `PATCH` first, then creates `catalog.ttl` only if the initial request returns `404`, and retries the `INSERT DATA` update.
- **`removeFromCatalog(catalogUri, instanceUri, fetch)`** — `PATCH`es `catalog.ttl` with `DELETE WHERE` to remove the dataset and its distribution node in one request. Returns early if the catalog is not readable before the patch step.
- **`linkCatalogToProfile(catalogUri, webId, fetch)`** — adds a `dcat:catalog` triple to the WebID profile document so external agents can discover the catalog. Only called on first upload (guarded by `profileHasCatalog` in `FileUpload`).
- **`parseCatalog(turtleText, baseUri?)`** — parses a `catalog.ttl` Turtle string into `CatalogEntry` objects. `baseUri` is optional and is used when relative IRIs in shared catalogs need to resolve to absolute resource URIs.

---

## `fileAccess.ts`

ACL utilities used by the sharing flow.

- **`discoverAclUri(containerUri, fetch)`** — resolves the ACL document from the resource `Link` header and normalizes relative ACL URLs against the target resource URI.
- **`readAclAgents(aclUri, fetch)`** — parses an ACL Turtle document with N3 and returns agents that have read access without write access.
- **`buildAclTurtle(...)` / `writeAcl(...)`** — build and persist a container ACL where grantees inherit read access to children through `acl:default`.
- **`buildListOnlyAclTurtle(...)` / `writeListOnlyAcl(...)`** — build and persist a container ACL where grantees can list the container without inheriting read access to child resources.
- **`buildResourceAclTurtle(...)` / `writeResourceAcl(...)`** — build and persist a resource ACL for a single document such as a shared catalog.

---

## `shareCatalog.ts`

Helpers for the per-contact shared catalog naming scheme.

- **`getAppContainerUri(storageRoot)`** — returns the app container path (`my-solid-app/`) for a storage root.
- **`getSharedCatalogFileName(granteeWebId)`** — derives the per-contact shared catalog filename.
- **`getSharedCatalogUri(appContainerUri, granteeWebId)`** — returns the absolute URI for the grantee-specific shared catalog.
- **`getCandidateSharedCatalogUris(appContainerUri, granteeWebId)`** — returns both the normalized and legacy filename variants so older shared catalogs remain discoverable.
- **`isSharedCatalogFile(fileName)`** — identifies `.shared-*.ttl` helper files so the explorer can hide them from the normal browser view.

---

## `i18n.ts`

Initialises `i18next` with bundled translation resources imported from `src/locales/en.json` and `src/locales/de.json`. Language detection order remains `localStorage -> navigator`, and the selected language is cached in `localStorage`.

## `pod.ts`

Type guards that narrow LDO resource union types. LDO exposes capabilities via method presence rather than a class hierarchy, so these guards use duck-typing.

| Guard | Checks for |
|---|---|
| `isLoadable` | `isLoading`, `isUnfetched`, and `isFetched` methods |
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
