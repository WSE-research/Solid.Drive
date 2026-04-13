# i18n

## Overview

Configures i18next with browser language detection and React integration. Loads translation files from `../locales/`, falls back to English if the user's language isn't supported, and caches the selected language to `localStorage`.

## Usage

All language constants (supported codes, fallback, detection order) come from `@/config`. Import the configured instance anywhere you need `i18n.changeLanguage()` directly, but most components should use the `useTranslation` hook instead.
