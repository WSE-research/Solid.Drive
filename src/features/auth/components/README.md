# auth/components

## Overview

UI components for authentication and site-level controls.

## Contents

| Name | Description |
|---|---|
| **Header** | The main site header. Handles the full login flow (provider selection, custom provider input, login button) and the logged-in state (display name, logout button, language switcher) |
| **LanguageSwitcher** | A `<select>` that calls `i18n.changeLanguage`. Rendered in both logged-in and logged-out header states |
