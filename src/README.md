# src

## Components

### `App.tsx`

Wraps the tree in `BrowserSolidLdoProvider`. Required — without it no component can access the Solid session or LDO hooks.

### `Header.tsx`

Top-level authentication bar for login and logout. The provider dropdown lets users choose their identity provider, since Solid uses decentralized Pods instead of a single identity server. Also renders `LanguageSwitcher` in both the logged-in and logged-out states.

### `LanguageSwitcher.tsx`

Dropdown that lets users switch the UI language at runtime. Supported languages: English, German. Uses `i18next`'s `changeLanguage` under the hood.

### `FileExplorer.tsx`

Owns navigation state (current URI + breadcrumbs). Resolves the Pod storage root on first render and creates `my-solid-app/` if absent. Renders `FileCard` inside the app folder, `FolderEntry` everywhere else.

### `FileUpload.tsx`

Runs the upload sequence: 

```
ensure `tbox.ttl` exists → resolve TBox class from MIME type → create container → upload binary → write `index.ttl` → append to `catalog.ttl`. 
```
Any failure after the binary is written triggers a full rollback so no orphaned resources remain on the Pod.

### `FileCard.tsx`

Reads `index.ttl` and renders the binary inline (image, video, audio, or PDF) from a blob URL. The Info toggle shows all fields from `index.ttl`. Delete cleans up `catalog.ttl` before removing the container.

### `FolderEntry.tsx`

Navigable row for Pod containers outside the app folder. Kept separate from `FileCard` because it makes no assumptions about `index.ttl` being present.

### `DataCatalog.tsx`

Loads `catalog.ttl` and renders all ABox instances without scanning Pod containers. Composed of `TBoxView` and `ABoxView`.

### `TBoxView.tsx`

Renders the static TBox class table from `FILE_TYPE_DEFS` in `catalog.ts`.

### `ABoxView.tsx`

Renders one ABox instance from its `index.ttl`. Falls back to inferring the file class from `encodingFormat` for files uploaded before the TBox feature existed.

## `catalog.ts`

All TBox and ABox catalog logic in one file. The TBox Turtle, the class map, and the SPARQL functions are kept together because changing a class requires updating all three at once.

- `ensureTBox` — writes `tbox.ttl` if absent; throws on failure to block the upload
- `resolveClass` — maps a MIME type to the correct TBox class URI
- `appendToCatalog` — PATCHes `catalog.ttl` with `INSERT WHERE NOT EXISTS` to prevent duplicates on retry
- `removeFromCatalog` — PATCHes `catalog.ttl` with `DELETE WHERE` on file delete

## `i18n.ts`

Initialises `i18next` with the HTTP backend (translations loaded from `public/locales/<lang>/translation.json`) and browser-language detection (localStorage → navigator).

## `pod.ts`

Type guards for LDO resource union types (`isSolidContainer`, `isBinary`, `isDeletable`, etc.) and `formatBytes`. Guards are necessary because LDO does not guarantee which methods are available until the resource type is narrowed.

## Data Shapes

`.shapes/` defines what a valid Pod resource looks like. `.ldo/` is auto-generated from it — never edit directly. Run `npm run build:ldo` after any shape change.
