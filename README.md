[![Test Coverage](https://github.com/WSE-research/Solid-Hello-World-Frontend-React/actions/workflows/test-coverage.yml/badge.svg)](https://github.com/WSE-research/Solid-Hello-World-Frontend-React/actions/workflows/test-coverage.yml)
[![Docker Image](https://github.com/WSE-research/Solid-Hello-World-Frontend-React/actions/workflows/docker-image.yaml/badge.svg)](https://github.com/WSE-research/Solid-Hello-World-Frontend-React/actions/workflows/docker-image.yaml)

# solid.drive

## Overview

A file manager built on the [Solid Protocol](https://solidproject.org/). Every file is stored directly in the user's own Solid Pod — the server never holds a copy.

## Features

+ **Authentication:** log in via any OIDC-compliant Solid identity provider (`solidcommunity.net`, `inrupt.net`, `solidweb.org`, or a self-hosted server)
+ **Pod navigation:** browse the full Pod directory tree with breadcrumb navigation
+ **TBox-driven validation:** SHACL shapes are loaded from `public/tbox.ttl` at form open time; required fields (`name`, `uploadDate`, `publisher`) are enforced before upload; missing fields are surfaced inline
+ **File adoption:** renders files that existed on the Pod before the app was used, showing folder name and download button for containers lacking `index.ttl`
+ **File upload:** accepts any file type; stores the binary and a metadata document (`index.ttl`) inside a dedicated container on the Pod
+ **Semantic classification:** MIME type is mapped to a schema.org class and written to `index.ttl` as `rdf:type`
+ **Inline preview:** images, videos, audio, PDFs, and text files preview directly in the browser from a local blob URL — no request leaves the browser after the file is fetched
+ **Download:** triggers a browser-native download from the blob URL
+ **File info:** a toggle on each file card shows type, size, upload date, modified date, and publisher name resolved from their Solid profile
+ **Profile first catalog:** `dcat:catalog` is read from the user's WebID profile first, falling back to `${storageRoot}catalog.ttl`
+ **Catalog management:** `catalog.ttl` is updated on every upload and cleaned up on every delete using _SPARQL PATCH_
+ **Share / revoke access:** each owned file can be shared with contacts from the user's Solid profile; ACLs and per-contact shared catalogs are kept in sync
+ **Shared with Me:** reads per-contact shared catalogs first, then falls back to the contact's main catalog
+ **Filtered system files:** internal catalog and ACL helper files, including `.shared-*.ttl`, are hidden from the normal file browser
+ **Delete:** removes the binary, `index.ttl`, the container, and the catalog entry in the correct order so no orphaned resources remain
+ **Language switching:** switch the UI language at runtime with bundled English and German translations

## Prerequisites

+ Node.js >= 18

## Installation

```bash
npm install
```

## Usage

```bash
npm run dev           # extract TBox and start dev server
npm run build         # extract TBox, type check, and production build
npm test              # run tests once
npm run test:coverage # run tests with coverage report
```

```bash
docker run -p 3000:80 wseresearch/solid-hello-world-frontend-react
```

### Regenerating derived files

```bash
npm run tbox:extract  # refetch datashapes.org and rewrite public/tbox.ttl
npm run build:ldo     # recompile ShEx shapes → TypeScript bindings in src/.ldo/
```

`npm run dev` and `npm run build` both run `tbox:extract` automatically, so you only need the manual commands after editing `.shapes/` files or when the upstream ontology changes.

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

+ `image/*` → `schema:ImageObject`
+ `video/*` → `schema:VideoObject`
+ `audio/*` → `schema:AudioObject`
+ `text/*`, `application/pdf`, Word → `schema:TextDigitalDocument`
+ CSV, Excel → `schema:SpreadsheetDigitalDocument`
+ anything else → `schema:DigitalDocument`

## Tech Stack

+ **Frontend:** React 19 · TypeScript · Vite
+ **Solid / Linked Data:** [@ldo/solid](https://github.com/o-development/ldo) · @ldo/solid-react · ShEx · schema.org · DCAT · SHACL
+ **Internationalisation:** i18next · react-i18next · i18next-browser-languagedetector
+ **Testing:** Vitest · @testing-library/react · jsdom
+ **Deployment:** Docker · nginx

## Project Structure

```text
solid.drive/
|-- src/
|   |-- .shapes/              # ShEx shapes (edit here)
|   |-- .ldo/                 # LDO bindings (auto generated)
|   |-- app/                  # Root component, i18n, locales
|   |-- config/               # Constants and env vars
|   |-- features/
|   |   |-- auth/
|   |   |-- file-explorer/
|   |   |-- profile/
|   |   `-- sharing/          # WAC/ACL hooks
|   |-- infrastructure/       # Solid/RDF, no React
|   |   |-- inbox/            # LDP inbox messaging
|   |   |-- solid/            # Catalog, profile, display name
|   |   |-- validation/       # TBox, SHACL, file types
|   |   `-- wac/              # ACL read/write
|   |-- shared/               # Components, contexts, utils
|   |-- types/
|   `-- assets/
|-- public/
|   |-- tbox.ttl              # SHACL TBox (auto generated)
|   `-- vite.svg
|-- scripts/
|   |-- extract-tbox.mjs      # Writes public/tbox.ttl
|   `-- fix-ldo-types.mjs     # Fixes LDO codegen output
|-- service_config/
|   `-- service_config.json   # Docker config
|-- .github/                  # CI/CD and issue templates
|-- Dockerfile
|-- nginx.conf
|-- vite.config.ts
|-- vitest.config.ts
`-- TESTER_GUIDE.md
```

See [src/README.md](src/README.md) for the full layer map and dependency rules.
See [src/.shapes/README.md](src/.shapes/README.md) for shape definitions.
See [TESTER_GUIDE.md](TESTER_GUIDE.md) for manual QA steps.

## Known Issues

+ **`inrupt.net` blocks localhost redirects** — the inrupt.net identity provider rejects OIDC redirect URIs pointing to `localhost`. Use `solidcommunity.net` or `solidweb.org` when testing locally.
