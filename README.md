# solid.drive

Your files, your Pod. solid.drive is a file manager built on the [Solid Protocol](https://solidproject.org/) that stores everything directly in your own Solid Pod, nothing passes through a central server.

## Architecture

<details>
<summary>View architecture diagram</summary>

![Architecture diagram](docs/architecture.svg)

Regenerate with:
```bash
java -jar plantuml.jar -tsvg docs/architecture.puml
```

</details>

## Features

- Authenticate with any OIDC-compliant Solid identity provider (`solidcommunity.net`, `inrupt.net`, `solidweb.org`, or custom)
- Browse your entire Pod with breadcrumb navigation
- Upload files with a custom title and optional description
- View uploaded files with metadata, image preview, download, and delete
- Switch the UI language at runtime

## Tech Stack

- **Frontend** — React 19 · TypeScript · Vite
- **Solid / Linked Data**: [@ldo/solid](https://github.com/o-development/ldo) · @ldo/solid-react · ShEx
- **Internationalisation**: i18next · i18next-browser-languagedetector · i18next-http-backend
- **Deployment**: Docker

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
docker run -p 40184:80 solid-hello-world-frontend-react
```

## Project Structure

```
solid.drive/
├── src/                         # Application source
│   ├── .shapes/                 # ShEx shape definitions
│   ├── .ldo/                    # Auto-generated LDO bindings
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
