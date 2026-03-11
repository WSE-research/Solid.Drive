# src

## Components

### `App.tsx`

Wraps everything in `BrowserSolidLdoProvider` so all components below can access the Solid session and LDO hooks.

### `Header.tsx`

Top-level authentication bar for login and logout. The provider dropdown lets users choose their identity provider, since Solid uses decentralized Pods instead of a single identity server. Also renders `LanguageSwitcher` in both the logged-in and logged-out states.

### `LanguageSwitcher.tsx`

Dropdown that lets users switch the UI language at runtime. Supported languages: English, German. Uses `i18next`'s `changeLanguage` under the hood.

### `FileExplorer.tsx`

Handles navigation state (URI and breadcrumbs). On first load it resolves the Pod storage root and creates `my-solid-app/` if it doesn't exist yet. Renders `FileCard` inside the app folder, raw `FolderEntry` rows everywhere else.

### `FileUpload.tsx`

Each upload creates a container (folder) that holds the binary file and an `index.ttl` for metadata, following the Solid standard for storing data in a Pod.

### `FileCard.tsx`

Reads metadata from `index.ttl` and resolves the binary URI by inspecting the container's children. Image previews are created in memory from the blob — no public URL needed.

### `FolderEntry.tsx`

Simple navigable row for Pod containers outside the app folder. Kept separate from `FileCard` because it makes no assumptions about structure or metadata.

## `i18n.ts`

Initialises `i18next` with the HTTP backend (translations loaded from `public/locales/<lang>/translation.json`) and browser-language detection (localStorage → navigator).

## `pod.ts`

Type guards (`isSolidContainer`, `isBinary`, `isDeletable`, etc.) to safely narrow LDO resource objects before calling methods on them. Also exports `formatBytes` used across multiple components.

## Data Shapes

`.shapes/` defines the data contract for what gets written to and read from the Pod. `.ldo/` is auto-generated from those shapes — never edit it directly. Run `npm run build:ldo` to regenerate.
