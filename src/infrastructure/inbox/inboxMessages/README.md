# inboxMessages

## Overview

Low level message parsing and serialization for Solid inbox messages. All serialization uses the N3 library. Message types are identified by `rdf:type` using the `solid-access:` vocabulary.

## Functions

| Function | Description |
|---|---|
| `discoverInboxUriFromProfile(profileDocUri, webId, turtle)` | Parses a profile Turtle string to find the `ldp:inbox` triple |
| `buildAccessRequestMessage(type, requesterWebId, accessTo)` | Creates Turtle for an access request |
| `buildAccessRejectionMessage(accessTo)` | Creates Turtle for a rejection notification |
| `parseContainedResourceUris(inboxUri, turtle)` | Extracts `ldp:contains` URIs from a container listing |
| `parseAccessRequestMessage(messageUri, turtle)` | Parses a Turtle message into an `AccessRequest` |
| `parseAccessRejectionMessage(messageUri, turtle)` | Parses a Turtle message into an `AccessRejection` |
