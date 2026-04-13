# infrastructure/solid

## Overview

Core Solid protocol utilities. No React hooks — these are pure async functions and type guards.

## Contents

| Name | Description |
|---|---|
| **catalog/** | DCAT catalog CRUD: append, remove, parse, resolve URI, link to profile |
| **displayName/** | Resolve a display name from a Solid profile document |
| **profile/** | Patch profile fields (`foaf:name`, `foaf:img`, `foaf:knows`) via N3 Solid Patch |
| **rdfUtils/** | Serialize N3 quads to Turtle |
| **resourceGuards/** | Type guard functions for LDO resource shapes |
| **sharedCatalog/** | Per-contact shared catalog naming, URI helpers, and access checks |
