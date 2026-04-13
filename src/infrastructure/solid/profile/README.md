# profile

## Overview

SPARQL/N3 Patch operations for modifying Solid profile documents. All WebID and image URL parameters are validated to be safe `http(s)://` URIs before being inserted into patch bodies. String literals are escaped to prevent injection.

## Functions

| Function | Description |
|---|---|
| `saveProfileFields(webId, original, fields, fetch)` | Patches `foaf:name` and `foaf:img` (deletes old values, inserts new ones) |
| `ensureProfileDocType(webId, fetch)` | Adds `foaf:PersonalProfileDocument` and `foaf:Person` type triples if missing |
| `addContact(webId, contactWebId, fetch)` | Inserts a `foaf:knows` triple |
| `removeContact(webId, contactWebId, fetch)` | Deletes a `foaf:knows` triple |
