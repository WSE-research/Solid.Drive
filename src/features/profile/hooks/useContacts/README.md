# useContacts

## Overview

Manages the `foaf:knows` contact list in a Solid profile. Reads contacts from the LDO-subscribed profile and keeps local state in sync.

## Actions

| Action | Description |
|---|---|
| `addContact` | Validates for duplicates, patches the profile document, and reloads it |
| `removeContact` | Patches the profile to delete the triple |

## Returns

| Field | Description |
|---|---|
| `contacts` | Current list of contact WebIDs |
| `addContact` | Function to add a contact |
| `removeContact` | Function to remove a contact |
| `isAdding` | Boolean flag indicating an add operation is in progress |
