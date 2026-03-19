# src

## Components

### `App.tsx`

Entry point. Wraps the component tree in `BrowserSolidLdoProvider`, which manages the Solid session and exposes LDO hooks to every child component. Nothing below this can authenticate or read Pod data without it.

### `Header.tsx`

Login/logout bar. Includes a provider dropdown so the user can specify their identity server — necessary because Solid is decentralised and there is no single login endpoint.

### `FileExplorer.tsx`

Manages navigation: the current container URI and the breadcrumb trail. On first render it resolves the Pod storage root from the session and creates the `my-solid-app/` container if it doesn't exist yet. Within that folder it renders a `FileCard` for each file container; outside it renders a `FolderEntry` for each sub-container the user browses into.

### `FileUpload.tsx`

Handles the full upload sequence in order:

```
resolve schema.org class from MIME type
  → create container (e.g. my-solid-app/photo-001/)
    → upload binary (photo.jpg)
      → write index.ttl (file metadata as Linked Data)
        → append entry to catalog.ttl
          → link catalog to profile (only on first upload)
```

If any step after the binary upload fails, the entire container is deleted so no half-written resources are left on the Pod. The `profileHasCatalog` prop prevents overwriting a user's custom catalog pointer with a second `dcat:catalog` triple.

### `FileCard.tsx`

Displays a single uploaded file. It reads `index.ttl` with `useSubject` to get the metadata, then locates the binary inside the same container and renders it inline — as an `<img>`, `<video>`, `<audio>`, or `<iframe>` depending on the MIME type. The publisher's WebID is resolved to a display name by loading their Solid profile. The Info panel shows all metadata fields. Delete removes the catalog entry first, then deletes the container.

For containers without `index.ttl` (files that existed on the Pod before the app was used), a fallback card renders showing the folder name and a download button for any binary file inside the container.

### `FolderEntry.tsx`

A navigable row for Pod containers that are not managed by this app. Kept separate from `FileCard` because it cannot assume `index.ttl` or any app-specific metadata exists.

---

## `useCatalogUri.ts`

Helper to resolve the catalog URI from user context:

- **`resolveCatalogUri(profile, storageRoot)`**: checks the user's WebID profile for a `dcat:catalog` triple first. If found, returns that URI. If not, falls back to `${storageRoot}catalog.ttl`. This enables users to bring their own catalog from another Solid app and have it recognized automatically.

---

## `podCatalog.ts`

All catalog read/write logic. File types come from the schema.org vocabulary — no custom ontology is needed.

- **`resolveClass(mimeType)`**: maps a MIME type to a schema.org class URI. Spreadsheet types (`text/csv`, `.xls`, `.xlsx`) are checked before the generic `text/*` wildcard so they are not misclassified as documents. Falls back to `schema:DigitalDocument` for unknown types.

- **`appendToCatalog(catalogUri, ...)`**: takes the catalog URI as an explicit parameter. Creates `catalog.ttl` with a SPARQL `PUT` if it does not exist, then `PATCH`es it with `INSERT DATA` to add a `dcat:Dataset` node and its linked `dcat:Distribution` (access URL, media type, byte size).

- **`removeFromCatalog(catalogUri, ...)`**: takes the catalog URI as an explicit parameter. `PATCH`es `catalog.ttl` with `DELETE WHERE` to remove both the dataset node and its distribution node when a file is deleted.

- **`linkCatalogToProfile(catalogUri, webId, fetch)`**: adds a `dcat:catalog` triple to the user's WebID profile document so external agents can discover the catalog. Only called on first upload when the profile has no existing `dcat:catalog` (controlled by the `profileHasCatalog` guard in `FileUpload`).

- **`parseCatalog(turtleText)`**: parses a `catalog.ttl` Turtle string into `CatalogEntry` objects used by the UI. Extracts each `dcat:dataset` URI, then pulls its metadata and distribution properties using targeted regex matches against each subject block.

---

## `pod.ts`

Type guards that narrow LDO resource union types (`isSolidContainer`, `isBinary`, `isReadable`, `isDeletable`) and a `formatBytes` helper. The guards are necessary because LDO does not expose all methods on every resource type, narrowing is required before calling `.getBlob()`, `.delete()`, etc.

---

## Data Shapes

`.shapes/` contains ShEx shape definitions that describe what a valid `index.ttl` looks like. `.ldo/` holds the TypeScript bindings auto-generated from those shapes — never edit `.ldo/` by hand. After changing any shape file, run:

```
npm run build:ldo
```
