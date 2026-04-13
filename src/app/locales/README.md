# locales

## Overview

Translation files for the UI.

## Contents

| Name | Description |
|---|---|
| `en.json` | English (default) |
| `de.json` | German |

## Adding a new language

| Step | Action |
|---|---|
| 1 | Create a new JSON file here with the language code as its name |
| 2 | Add the language code to `SUPPORTED_LANGUAGES` in `@/config/constants` |
| 3 | Import the file in `@/app/i18n` |

Keys are dot-separated and match the `t('key')` calls in components.
