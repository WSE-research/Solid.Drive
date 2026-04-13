# useFileValidation

## Overview

Validates upload form data against SHACL shapes from `tbox.ttl`. Loads the TBox once on mount, then re-validates whenever the file, title, description, or WebID changes.

`validation.valid` is `false` if any required property is missing. The `violations` array includes a property label and description so the UI can show actionable error messages.

## Returns

| Value | Description |
|---|---|
| `validation` | `{ valid, violations }` — result of the current SHACL check |
| `tboxError` | Error message if the TBox could not be loaded, otherwise `null` |
| `isReady` | `true` when the TBox is loaded and validation has run at least once |
