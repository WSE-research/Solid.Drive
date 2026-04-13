# shared/hooks

## Overview

React hooks shared across features. Nothing here should import from a specific feature module — hooks that belong to a single feature live under `features/<name>/hooks/` instead.

## Contents

| Hook | Description |
|---|---|
| `useContactRejections` | Fetches LDP inbox rejection notifications for all contacts and exposes a per-contact dismiss handler |
