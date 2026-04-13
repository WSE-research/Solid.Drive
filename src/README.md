# src

## Overview

The entire application lives here. The structure follows a layered architecture. Features depend on infrastructure, and both may use shared. Infrastructure never imports from features.

## Architecture

```mermaid
graph TD
    app["app/\nentry point, i18n"]
    features["features/\nauth · file-explorer · profile · sharing"]
    infrastructure["infrastructure/\nsolid · inbox · validation · wac"]
    shared["shared/\ncomponents · contexts · hooks · utils"]
    config["config/\nconstants · env"]
    types["types/\nshared TypeScript types"]

    app --> features
    features --> infrastructure
    features --> shared
    infrastructure --> shared
    app --> shared
    features --> config
    infrastructure --> config
    shared --> config
    features --> types
    infrastructure --> types
    shared --> types
```

**Key rule:** `infrastructure/` never imports from `features/`. The `sharing` feature is the only cross-feature dependency (`file-explorer` uses `features/sharing/hooks/useAclManager`).

## Contents

| Name | Description |
|---|---|
| **app/** | Entry point, i18n setup, and locale files |
| **config/** | Constants and environment variables (single source of truth) |
| **features/** | UI features grouped by domain (`auth`, `file-explorer`, `profile`, `sharing`) |
| **infrastructure/** | Service layer: Solid protocol, RDF utilities, inbox, validation, WAC |
| **shared/** | Reusable components, contexts, and utilities used across features |
| **types/** | Shared TypeScript types |
| **.ldo/** | Auto-generated LDO typed data objects (do not edit by hand) |
| **.shapes/** | ShEx shape files used to generate the LDO types |
