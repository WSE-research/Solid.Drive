# acl Manager

## Overview

Low-level WAC ACL discovery, reading, and writing. All ACL documents are serialized using N3 via `rdfUtils.serializeTurtle`.

## Functions

| Function | Description |
|---|---|
| `discoverAclUri(resourceUri, fetch)` | Reads the `Link` header for `rel="acl"` and returns the absolute ACL URI |
| `readAclAgents(aclUri, fetch)` | Parses an ACL Turtle document and returns agent WebIDs with read (but not write) access |
| `writeAcl(aclUri, resourceUri, ownerWebId, grantees, fetch)` | Writes a full ACL: owner with Read/Write/Control + `acl:default`; grantees with Read + `acl:default` |
| `writeListOnlyAcl(...)` | Writes an ACL where grantees can list the container but do not inherit access to child resources |
| `writeResourceAcl(...)` | Writes an ACL for a single resource (no `acl:default` propagation) |
