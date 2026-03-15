# solid.drive

solid.drive is a file manager built on the [Solid Protocol](https://solidproject.org/). Every file is stored directly in the user's own Solid Pod — the server never holds a copy of the data.

Each uploaded file is assigned a semantic class (Image, Video, Audio, Document, or general File) defined in a TBox ontology that lives on the Pod. This makes the data discoverable and consumable by other Solid-compatible applications without requiring access to this app.

## Architecture

<details>
<summary>View architecture diagram</summary>

![Architecture diagram](docs/architecture.svg)

</details>

Regenerate with:
```bash
java -jar plantuml.jar -tsvg docs/architecture.puml
```

## Features

- **Authentication**: logs in via any OIDC-compliant Solid identity provider (`solidcommunity.net`, `inrupt.net`, `solidweb.org`, or a self-hosted server)
- **Pod navigation**: browse the full Pod directory tree with breadcrumb navigation
- **File upload**: accepts any file type; stores the binary and a metadata document (`index.ttl`) inside a dedicated container on the Pod
- **Semantic classification**: MIME type is mapped to a TBox subclass (`app:ImageFile`, `app:VideoFile`, `app:AudioFile`, `app:TextDocument`, or `schema:DigitalDocument`) and written to `index.ttl` as `rdf:type`
- **Inline preview**: images render as `<img>`, videos as `<video>`, audio as `<audio>`, PDFs and text files as `<iframe>`, all from a local blob URL — no request leaves the browser after the file is fetched
- **Download**: triggers a browser-native download from the blob URL, not a redirect to the Pod server
- **File info**: a toggle on each file card shows: type, title, description, MIME type, size, upload date, and publisher WebID: all read from `index.ttl`
- **Catalog**: `catalog.ttl` at the storage root is updated on every upload and cleaned up on every delete, so the full list of files and their classes is always queryable without scanning Pod containers
- **Delete**: removes the binary, `index.ttl`, the container, and the entry in `catalog.ttl` in the correct order so no orphaned resources remain
- Switch the UI language at runtime

## Tech Stack

- **Frontend** — React 19 · TypeScript · Vite
- **Solid / Linked Data** — [@ldo/solid](https://github.com/o-development/ldo) · @ldo/solid-react · ShEx · OWL · RDF Schema
- **Internationalisation** — i18next · i18next-browser-languagedetector · i18next-http-backend
- **Deployment** — Docker

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org/)
- **npm** — bundled with Node.js

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

## Docker

```bash
docker run -p 3000:80 solid-hello-world-frontend-react
```

## Project Structure

```
solid.drive/
├── src/                         # Application source
│   ├── .shapes/                 # ShEx shape definitions
│   ├── .ldo/                    # Auto-generated LDO bindings (never edit directly)
│   └── ...
├── docs/                        # Architecture diagrams
├── public/
│   └── locales/                 # i18n translation files
├── .github/                     # CI/CD workflows and issue templates
├── Dockerfile
├── nginx.conf
├── index.html
├── vite.config.ts
└── package.json
```

For component details see [src/README.md](src/README.md).
