# displayName

## Overview

`resolveDisplayName(webId, fetch)` — fetches a Solid profile document and returns the best available display name.

## Functions

| Function | Description |
|---|---|
| `resolveDisplayName(webId, fetch)` | Fetches a Solid profile and returns the best available display name, trying `vcard:fn`, then `foaf:name`, then falling back to the WebID itself |

## Usage

Useful in non-React contexts where you need a display name without an LDO hook subscription. For React components, prefer `useSubject(SolidProfileShapeType, webId)` + `getProfileDisplayName` from `@/shared/utils` so the name reactively updates.
