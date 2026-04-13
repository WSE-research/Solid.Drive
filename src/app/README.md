# app

## Overview

Application bootstrap and setup. Contains the root React component, i18n configuration, and locale translation files.

## Contents

| Name | Description |
|---|---|
| **App/** | The root React component that wires together providers and layout |
| **i18n/** | i18next configuration (language detection, supported languages, fallback) |
| **locales/** | Translation JSON files (`en.json`, `de.json`) |

`main.tsx` renders `<App />` into the DOM. Everything else flows from there.
