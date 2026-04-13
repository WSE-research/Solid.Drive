# Profile Display Name

## Overview

`getProfileDisplayName(profile, webId): string` — picks the best available display name from a Solid profile. Used by `ContactRow`, `RequesterRow`, and anywhere a pure text name is needed from a profile object.

## Returns

| Priority | Source |
|---|---|
| 1 | `vcard:fn` (`profile.fn`) |
| 2 | `foaf:name` (`profile.name`) |
| 3 | Domain derived fallback from the WebID (e.g., `anna.example`) |
| 4 | The full WebID as last resort |
