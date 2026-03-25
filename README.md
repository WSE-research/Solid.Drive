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

Each uploaded file gets a dedicated container on the Pod. A DCAT catalog at the storage root keeps a queryable index of all files:

```
Pod storage root/
├── catalog.ttl                  ← DCAT catalog: one entry per file
└── my-solid-app/
    └── photo-2024-01-01/        ← one container per uploaded file
        ├── photo.jpg            ← the binary
        └── index.ttl            ← schema.org metadata (type, name, date, publisher)
```

The user's WebID profile gets a `dcat:catalog` triple pointing to `catalog.ttl` on first upload so other Solid apps can discover the catalog automatically.

### Upload sequence

```
pick file
  → validate metadata against SHACL shapes (tbox.ttl) — block if required fields missing
    → resolve schema.org class from MIME type
      → create container (my-solid-app/photo-2024-01-01/)
        → upload binary (photo.jpg)
          → write index.ttl (schema.org metadata as Linked Data)
            → append dcat:Dataset entry to catalog.ttl
              → link catalog to WebID profile (first upload only)
```

If any step after the binary upload fails, the whole container is deleted — no half-written resources are left on the Pod.

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

- **Authentication** — OIDC login via `solidcommunity.net`, `inrupt.net`, `solidweb.org`, or a custom provider; registration links per provider
- **Pod navigation** — browse the full Pod directory tree with breadcrumb navigation and a refresh button
- **TBox-driven validation** — SHACL shapes are loaded from `public/tbox.ttl` (auto-generated from datashapes.org) at form open time; required fields (`name`, `uploadDate`, `publisher`) are enforced before the upload button is enabled; missing fields are surfaced inline
- **File upload** — accepts any file type with optional title and description; stores binary and `index.ttl` inside a dedicated container
- **Inline preview** — images (`<img>`), videos (`<video>`), audio (`<audio>`), PDFs and text (`<iframe>`) rendered from a local blob URL
- **File info panel** — type, title, description, MIME, size, upload date, last modified date, and publisher name resolved from the publisher's Solid profile
- **Profile-first catalog** — reads `dcat:catalog` from the WebID profile first, falling back to `${storageRoot}catalog.ttl`; users who bring their own catalog from another app have it recognized automatically
- **Catalog management** — `catalog.ttl` updated on every upload and delete via SPARQL PATCH; the full file list is always queryable without scanning Pod containers
- **Delete** — removes catalog entry, binary, `index.ttl`, and container in the correct order; no orphaned resources
- **File adoption** — containers without `index.ttl` (pre-existing Pod files) render a fallback card with folder name and download button

## Known Issues

- **`inrupt.net` blocks localhost redirects** — the inrupt.net identity provider rejects OIDC redirect URIs pointing to `localhost`. Use `solidcommunity.net` or `solidweb.org` when testing locally.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19 · TypeScript · Vite |
| Solid / Linked Data | [@ldo/solid](https://github.com/o-development/ldo) · @ldo/solid-react · ShEx · schema.org · DCAT · SHACL |
| Testing | Vitest · @testing-library/react · jsdom |
| Deployment | Docker · nginx |

## Getting Started

**Prerequisites:** Node.js ≥ 18

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

```
solid.drive/
├── src/
│   ├── .shapes/          # ShEx shape definitions (edit these)
│   ├── .ldo/             # LDO TypeScript bindings (auto-generated, never edit)
│   ├── App.tsx           # Root component, Solid provider setup
│   ├── Header.tsx        # Auth bar with provider dropdown
│   ├── FileExplorer.tsx  # Navigation, breadcrumbs, file listing
│   ├── FileUpload.tsx    # Upload form with TBox validation and Pod write sequence
│   ├── FileCard.tsx      # File display, inline preview, info panel, delete
│   ├── FolderEntry.tsx   # Navigable row for non-app Pod containers
│   ├── pod.ts            # LDO type guards and byte-format helper
│   ├── podCatalog.ts     # Catalog CRUD via SPARQL (append, remove, parse, link)
│   ├── useCatalogUri.ts  # Resolve catalog URI (profile-first, fallback)
│   ├── tboxValidator.ts  # Load tbox.ttl, parse SHACL shapes, validate metadata
│   └── generateShape.ts  # Discover RDF shapes from Turtle data
├── public/
│   └── tbox.ttl          # SHACL TBox (auto-generated by scripts/extract-tbox.mjs)
├── scripts/
│   ├── extract-tbox.mjs  # Fetch datashapes.org, reduce to app shapes, write public/tbox.ttl
│   └── tbox-cardinality.ttl  # App-specific minCount overrides (which fields are required)
├── tests/
│   ├── components/       # Component tests (Header, FolderEntry)
│   ├── unit/             # Unit tests (catalog-api, catalog-parse, pod, generateShape, useCatalogUri, tboxValidator)
│   └── setup.ts          # Vitest + jsdom setup
├── docs/
│   ├── architecture.puml # PlantUML diagram source
│   └── architecture.svg  # Generated SVG
├── Dockerfile
├── nginx.conf
└── vite.config.ts
```

See [src/README.md](src/README.md) for component and module details.
See [src/.shapes/README.md](src/.shapes/README.md) for shape definitions.
