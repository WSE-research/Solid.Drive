# src

## Components

### `App.tsx`

Wraps the tree in `BrowserSolidLdoProvider`. Required — without it no component can access the Solid session or LDO hooks. When logged in, renders `ProfileSidebar` on the left alongside the main `FileExplorer`.

### `Header.tsx`

Login / logout bar. Exposes a provider dropdown because Solid is decentralised — the app must know which identity server to authenticate against.

### `ProfileSidebar.tsx`

Social identity on Solid is more than a display name, it includes a live contact graph (`foaf:knows`) that links one WebID to others across different pods. `ProfileSidebar` is where the app exposes that: it reads the logged-in user's WebID profile document via LDO and lets them edit their name, avatar, and contacts without leaving the app.

Every write goes through N3 Patch (`solid:InsertDeletePatch`), not SPARQL UPDATE, because NSS does not support SPARQL UPDATE on profile documents. Contact profiles are fetched per-row by `ContactRow`; it strips the `#fragment` from the WebID before requesting the document because the document lives at the base IRI, the fragment identifies the person within it, not a separate resource.

### `FileExplorer.tsx`

Owns navigation state (current URI + breadcrumbs). Resolves the Pod storage root on first render and creates `my-solid-app/` if absent. Renders `FileCard` inside the app folder, `FolderEntry` everywhere else. Passes `handleReload` to `FileUpload` so the file list refreshes automatically after a successful upload. Exposes a **File Catalog** button that opens the `DataCatalog` modal.

### `FileUpload.tsx`

Runs the upload sequence:

```
ensure `tbox.ttl` exists → resolve TBox class from MIME type → sanitize filename → create container → upload binary → write `index.ttl` → append to `catalog.ttl`
```

Filenames are sanitized to lowercase alphanumeric + hyphens before upload (`safeFileName`) so that NSS does not reject the PUT request for filenames containing commas, parentheses, or other special characters. Any failure after the binary is written triggers a full rollback so no orphaned resources remain on the Pod. Calls `onUploadSuccess()` on completion so the parent can reload the file list.

### `FileCard.tsx`

Reads `index.ttl` and renders the binary inline (image, video, audio, or PDF) from a blob URL. The Info toggle shows all fields from `index.ttl`. Delete cleans up `catalog.ttl` before removing the container.

### `FolderEntry.tsx`

Navigable row for Pod containers outside the app folder. Kept separate from `FileCard` because it makes no assumptions about `index.ttl` being present.

### `DataCatalog.tsx`

Opens as a modal, fetches `catalog.ttl` fresh on each open, and shows the 2 most recent uploads sorted by `dcterms:modified`. Composed of `TBoxView` and `ABoxView`.

### `TBoxView.tsx`

Renders the static TBox class table from `FILE_TYPE_DEFS` in `catalog.ts`.

### `ABoxView.tsx`

Renders one catalog entry from a parsed `CatalogEntry`: title, type label (via `friendlyLabel`), byte size, date, description, media type, and publisher username.

## `foaf.ts`

Isolated write layer for FOAF profile edits. Keeping patch logic here rather than inside the component means there is one place to change if the server changes or if you want to extend what the app writes to the profile.

`saveProfileFields` replaces `foaf:name` and `foaf:img` in a single PATCH — combining both fields into one request avoids a window where another client could read the profile between two separate writes. `ensureProfileDocType` adds the `foaf:PersonalProfileDocument` and `foaf:primaryTopic` declarations on first edit; NSS-created profiles sometimes omit them, and some Solid clients require these types to recognise the document as a profile.

## `catalog.ts`

All TBox and ABox catalog logic in one file. The TBox Turtle, the class map, and the SPARQL functions are kept together because changing a class requires updating all three at once.

- `ensureTBox` — writes `tbox.ttl` if absent; throws on failure to block the upload
- `resolveClass` — maps a MIME type to the correct TBox class URI
- `appendToCatalog` — PATCHes `catalog.ttl` with `INSERT DATA` to add a `dcat:Dataset` (metadata URI) and its `dcat:Distribution` (media type + byte size). Does not store the binary URL — the binary path is always derivable from the container structure.
- `removeFromCatalog` — PATCHes `catalog.ttl` with `DELETE WHERE` on file delete
- `linkCatalogToProfile` — adds a `dcat:catalog` link to the user's WebID profile so the catalog can be discovered by others
- `parseCatalog` — reads a `catalog.ttl` Turtle document and converts it into `CatalogEntry` objects used by the UI
- `friendlyLabel` — converts a TBox class URI into a readable class label (e.g., ImageFile → Image File)

## `pod.ts`

Type guards for LDO resource union types (`isSolidContainer`, `isBinary`, `isDeletable`, etc.) and `formatBytes`. Guards are necessary because LDO does not guarantee which methods are available until the resource type is narrowed.

## Data Shapes

`.shapes/` defines what a valid Pod resource looks like. `.ldo/` is auto-generated from it — never edit directly. Run `npm run build:ldo` after any shape change.
