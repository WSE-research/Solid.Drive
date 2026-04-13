# tboxParser

## Overview

Parses SHACL NodeShape definitions from Turtle text. Pure parsing — no I/O.

## Returns

| Value | Description |
|---|---|
| `shapes` | Map of shape URI → `ShapeDefinition` for all `sh:NodeShape` nodes |
| `parents` | Map of child URI → parent URIs via `rdfs:subClassOf` |
