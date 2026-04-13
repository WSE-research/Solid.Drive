# .shapes

## Overview

ShEx (Shape Expressions) files that define the RDF data shapes used by LDO.

## Contents

| Name | Description |
|---|---|
| `solidProfile.shex` | Shape for a Solid WebID profile (name, avatar, contacts, storage, inbox) |
| `catalogEntry.shex` | Shape for a DCAT catalog entry (file metadata stored in `index.ttl`) |

## Usage

After editing a `.shex` file, run the LDO generator to update the corresponding files in `../.ldo/`:

```
npm run build:ldo
```

These shapes are intentionally minimal — they declare only the fields the app needs. The `EXTRA a` flag in the profile shape lets profiles with unexpected `rdf:type` declarations pass through, which is important across different Solid server implementations.
