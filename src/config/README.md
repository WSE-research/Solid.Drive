# config

## Overview

Single source of truth for all application configuration. Nothing should be hard-coded in components or services — it belongs here.

## Contents

| Name | Description |
|---|---|
| **constants/** | All application-wide constants (providers, namespaces, file types, UI limits, etc.) |
| **env/** | Typed wrapper around `import.meta.env` values |

Import from `@/config` (re-exports everything from both submodules).
