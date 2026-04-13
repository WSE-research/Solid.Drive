# auth

## Overview

Everything related to Solid authentication. Handles the full login flow: picking a provider, initiating the Solid OIDC redirect, and displaying the WebID profile name once authenticated.

## Contents

| Path | Description |
|---|---|
| `components/Header` | Site header with provider selection (logged out) or user info (logged in) |
| `components/LanguageSwitcher` | Language dropdown, rendered inside the header |
| `hooks/useAuth` | Thin wrapper around `useSolidAuth` exposing login state, WebID, and auth actions |
