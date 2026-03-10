# solid.drive

A personal file drive built on the [Solid Protocol](https://solidproject.org/). Users authenticate with their own Solid Pod and store files directly in it, no central server, no database, no account on this app.

## Architecture

<details>
<summary>View architecture diagram</summary>

![Architecture diagram](docs/architecture.svg)

<details>

Regenerate with:
```bash
java -jar plantuml.jar -tsvg docs/architecture.puml
```
</details>

</details>

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Solid integration | [@ldo/solid](https://github.com/o-development/ldo), [@ldo/solid-react](https://github.com/o-development/ldo) |
| Data shapes | ShEx (via `@ldo/cli`) |
| Linting | ESLint + typescript-eslint |
| Container | Docker (port 3000 → 80) |

## Features

- **Pod login**: authenticate with any OIDC-compliant Solid identity provider (`solidcommunity.net`, `inrupt.net`, `solidweb.org`, or custom)
- **Create a Pod**: link to registration for users who don't have a Pod yet
- **Full pod browser**: navigate your entire Pod with breadcrumb navigation
- **File upload**: upload any file with a custom title and optional description
- **File cards**: view uploaded files with type, size, upload date, preview (images), download, and delete
- **No central account**: your Pod is your identity and storage; nothing is stored on this app's server

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm

### Install

```bash
npm install
```

### Develop

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Docker

```bash
docker run -p 3000:80 wseresearch/solid-hello-world-frontend-react:latest
```

App is then available at `http://localhost:3000`.

## Project Structure

```
src/
├── .shapes/                    # ShEx shape definitions (source of truth for data models)
│   ├── post.shex               File/upload schema (schema.org vocabulary)
│   └── solidProfile.shex       Solid WebID profile schema
├── .ldo/                       # Auto-generated LDO bindings (do not edit manually)
├── App.tsx                     # Root component  
BrowserSolidLdoProvider
├── Header.tsx                  # Auth bar — provider select, login/logout, create-a-pod link
├── FileExplorer.tsx            # Pod browser — navigates containers, renders cards or folder rows
├── FileUpload.tsx              # Upload form — file picker, title, description, submit
├── FileCard.tsx                # Uploaded file card — metadata, preview, download, delete
├── FolderEntry.tsx             # Clickable folder row used when browsing outside app folder
└── pod.ts                      # Type guards and utilities for LDO/Solid resource capabilities
```

## Data Model

Each uploaded file gets its own container in the Pod:

```
{pod-storage}/my-solid-app/{file-slug}/
├── index.ttl       ← metadata (Turtle)
└── original-file   ← binary file
```

The metadata shape uses the `schema.org` vocabulary:

| Field | Predicate | Type | Required |
|---|---|---|---|
| Display title | `schema:name` | string | no (defaults to filename) |
| Description | `schema:description` | string | no |
| MIME type | `schema:encodingFormat` | string | no |
| File size | `schema:contentSize` | string (bytes) | no |
| Upload date | `schema:uploadDate` | date | yes |
| Uploader | `schema:publisher` | IRI (WebID) | yes |

## Regenerating LDO Types

If you modify the `.shex` shape files, regenerate the LDO bindings with:

```bash
npm run build:ldo
```

This runs `ldo build` and then applies a post-processing fix ([fix-ldo-types.mjs](fix-ldo-types.mjs)) to correct type compatibility issues in the generated output.

## Linting

```bash
npm run lint
```
