# rdfUtils

## Overview

Small utility for serializing RDF data.

`serializeTurtle(quads, prefixes?)` — converts an array of N3 `Quad` objects into a Turtle string. Accepts an optional prefix map for cleaner output. Used by `aclManager` and `inboxMessages` to build HTTP request bodies.
