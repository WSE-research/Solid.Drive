# solid.drive

A file manager built on the [Solid Protocol](https://solidproject.org/). Every file is stored directly in the user's own Solid Pod — the server never holds a copy.

<details>
<summary>Architecture diagram</summary>

![Architecture diagram](docs/architecture.svg)

Regenerate with:
```bash
java -jar plantuml.jar -tsvg docs/architecture.puml
```

</details>

## How it works

### Pod layout

Each uploaded file gets a dedicated container on the Pod. A DCAT catalog at the storage root keeps a queryable index of all files, while the app container holds file data and per-contact shared catalogs:

```text
Pod storage root/
|-- catalog.ttl                  <- DCAT catalog: one entry per file
`-- my-solid-app/
    |-- .shared-<webid>.ttl      <- per-contact shared catalog for discovery
    `-- photo-2024-01-01/        <- one container per uploaded file
        |-- photo.jpg            <- the binary
        `-- index.ttl            <- schema.org metadata (type, name, date, publisher)
```

The user's WebID profile gets a `dcat:catalog` triple pointing to `catalog.ttl` on first upload so other Solid apps can discover the catalog automatically.

### Upload sequence

```text
pick file
  -> validate metadata against SHACL shapes (tbox.ttl) — block if required fields missing
    -> resolve schema.org class from MIME type
      -> create container (my-solid-app/photo-2024-01-01/)
        -> upload binary (photo.jpg)
          -> write index.ttl (schema.org metadata as Linked Data)
            -> append dcat:Dataset entry to catalog.ttl
              -> link catalog to WebID profile (first upload only)
```

If any step after the binary upload fails, the whole container is deleted — no half-written resources are left on the Pod.

### Sharing sequence

Sharing happens at the file-container level. When access is granted, the app updates the file container ACL and mirrors the file's catalog entry into a per-contact shared catalog inside `my-solid-app/`. That shared catalog gets its own ACL so the recipient can discover only the files shared with them.

Revoking access removes the recipient from the file container ACL and deletes the matching dataset entry from every candidate shared catalog filename for that contact. The explorer hides those `.shared-*.ttl` files from the normal file list, while the "Shared with Me" section reads them explicitly.

### Semantic classification

MIME types are mapped to [schema.org](https://schema.org/) classes so files are typed in a vocabulary any Solid app can understand:

| MIME | schema.org class |
|------|-----------------|
| `image/*` | `schema:ImageObject` |
| `video/*` | `schema:VideoObject` |
| `audio/*` | `schema:AudioObject` |
| `text/*`, `application/pdf`, Word | `schema:TextDigitalDocument` |
| CSV, Excel | `schema:SpreadsheetDigitalDocument` |
| anything else | `schema:DigitalDocument` |

## Features

- **Authentication**: logs in via any OIDC-compliant Solid identity provider (`solidcommunity.net`, `inrupt.net`, `solidweb.org`, or a self-hosted server)
- **Pod navigation**: browse the full Pod directory tree with breadcrumb navigation
- **TBox-driven validation**: SHACL shapes are loaded from `public/tbox.ttl` (auto-generated from datashapes.org) at form open time; required fields (`name`, `uploadDate`, `publisher`) are enforced before the upload button is enabled; missing fields are surfaced inline
- **File adoption**: renders files that existed on the Pod before the app was used, showing folder name and download button for containers lacking `index.ttl`
- **File upload**: accepts any file type; stores the binary and a metadata document (`index.ttl`) inside a dedicated container on the Pod
- **Semantic classification**: MIME type is mapped to a schema.org class (`schema:ImageObject`, `schema:VideoObject`, `schema:AudioObject`, `schema:TextDigitalDocument`, `schema:SpreadsheetDigitalDocument`, or `schema:DigitalDocument`) and written to `index.ttl` as `rdf:type`
- **Inline preview**: images render as `<img>`, videos as `<video>`, audio as `<audio>`, PDFs and text files as `<iframe>`, all from a local blob URL — no request leaves the browser after the file is fetched
- **Download**: triggers a browser-native download from the blob URL, not a redirect to the Pod server
- **File info**: a toggle on each file card shows: type, title, description, MIME type, size, upload date, and publisher name (resolved from their Solid profile); all metadata read from `index.ttl`
- **Profile-first catalog**: `dcat:catalog` is read from the user's WebID profile first, falling back to `${storageRoot}catalog.ttl`. Users who bring their own catalog from another app will have it recognized automatically
- **Catalog management**: `catalog.ttl` is updated on every upload and cleaned up on every delete using SPARQL PATCH, so the full list of files and their classes is always queryable without scanning Pod containers
- **Share / revoke access**: each owned file can be shared with contacts from the user's Solid profile; ACLs and per-contact shared catalogs are kept in sync
- **Shared with Me**: reads per-contact shared catalogs first, then falls back to the contact's main catalog so older shared data can still be discovered
- **Filtered system files**: internal catalog and ACL helper files, including `.shared-*.ttl`, are hidden from the normal file browser
- **Delete**: removes the binary, `index.ttl`, the container, and the entry in `catalog.ttl` in the correct order so no orphaned resources remain
- **Language switching**: switch the UI language at runtime with bundled English and German translations

## Known Issues

- **`inrupt.net` blocks localhost redirects** — the inrupt.net identity provider rejects OIDC redirect URIs pointing to `localhost`. Use `solidcommunity.net` or `solidweb.org` when testing locally.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19 · TypeScript · Vite |
| Solid / Linked Data | [@ldo/solid](https://github.com/o-development/ldo) · @ldo/solid-react · ShEx · schema.org · DCAT · SHACL |
| Internationalisation | i18next · react-i18next · i18next-browser-languagedetector |
| Testing | Vitest · @testing-library/react · jsdom |
| Deployment | Docker · nginx |

## Getting Started

**Prerequisites:** Node.js >= 18

```bash
npm install       # install dependencies
npm run dev       # start dev server
npm run build     # production build
npm test          # run tests
```

```bash
docker run -p 3000:80 solid-hello-world-frontend-react
```

## Project Structure

```text
solid.drive/
|-- src/
|   |-- .shapes/              # ShEx shape definitions (edit these)
|   |-- .ldo/                 # LDO TypeScript bindings (auto-generated, never edit)
|   |-- App.tsx               # Root component, Solid provider setup
|   |-- Header.tsx            # Auth bar with provider dropdown
|   |-- FileExplorer.tsx      # Navigation, breadcrumbs, owned files, shared files
|   |-- FileUpload.tsx        # Upload form with TBox validation and Pod write sequence
|   |-- FileCard.tsx          # File display, inline preview, info panel, share, delete
|   |-- SharePanel.tsx        # Grant/revoke access and shared catalog sync
|   |-- SharedWithMeSection.tsx # Shared file discovery from contacts
|   |-- FolderEntry.tsx       # Navigable row for non-app Pod containers
|   |-- fileAccess.ts         # ACL discovery, parsing, and writes
|   |-- shareCatalog.ts       # Shared catalog naming and lookup helpers
|   |-- pod.ts                # LDO type guards and byte-format helper
|   |-- podCatalog.ts         # Catalog CRUD via SPARQL (append, remove, parse, link)
|   |-- useCatalogUri.ts      # Resolve catalog URI (profile-first, fallback)
|   |-- tboxValidator.ts      # Load tbox.ttl, parse SHACL shapes, validate metadata
|   `-- generateShape.ts      # Discover RDF shapes from Turtle data
|-- public/
|   `-- tbox.ttl              # SHACL TBox (auto-generated by scripts/extract-tbox.mjs)
|-- scripts/
|   `-- extract-tbox.mjs      # Fetch datashapes.org, extract all shapes, write public/tbox.ttl
|-- tests/
|   |-- components/           # Component tests (Header, FolderEntry, i18n)
|   |-- unit/                 # Unit tests (catalog-api, catalog-parse, pod, generateShape, useCatalogUri, tboxValidator, shareCatalog)
|   `-- setup.ts              # Vitest + jsdom setup
|-- docs/
|   |-- architecture.puml     # PlantUML diagram source
|   `-- architecture.svg      # Generated SVG
|-- .github/                  # CI/CD workflows and issue templates
|-- Dockerfile
|-- nginx.conf
`-- vite.config.ts
```

See [src/README.md](src/README.md) for component and module details.
See [src/.shapes/README.md](src/.shapes/README.md) for shape definitions.
