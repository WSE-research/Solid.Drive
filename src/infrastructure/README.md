# infrastructure

## Overview

Protocol and service layer — no React, no UI. This code talks to the network, parses RDF, and handles Solid-specific protocols.

## Contents

| Name | Description |
|---|---|
| **inbox/** | Solid LDP inbox: access request messages, rejection notifications |
| **solid/** | Core Solid operations: catalog CRUD, profile patches, display name resolution, resource type guards, shared catalog naming, RDF utilities |
| **validation/** | TBox loading, SHACL shape validation, file type registry |
| **wac/** | Web Access Control: ACL discovery, reading, and writing |

Infrastructure modules only depend on `@/config`, `@/types`, and each other. They never import from `@/features` or `@/shared/contexts`.
