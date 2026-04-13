# validation

## Overview

Loads and uses the TBox ontology (`tbox.ttl`) for file type classification and SHACL-based metadata validation. The TBox file is served at `/tbox.ttl` and defines both the file type hierarchy (via `rdfs:subClassOf`) and the SHACL shapes (via `sh:NodeShape`) for each type.

## Contents

| Name | Description |
|---|---|
| **fileTypeRegistry** | Loads, caches, and queries schema.org file type definitions from `tbox.ttl`; maps MIME types to schema.org class URIs |
| **tboxParser** | Parses SHACL NodeShape definitions and `rdfs:subClassOf` relationships from Turtle text |
| **tboxTypes** | Type definitions for TBox validation (`PropertyConstraint`, `ShapeDefinition`, `ValidationResult`, `PropertyViolation`) |
| **tboxValidator** | Loads SHACL shapes from `tbox.ttl`, walks type hierarchies, and validates upload metadata against required properties |
| **generateShape** | Discovers RDF shapes from arbitrary Turtle data (used for tooling and inspection) |
