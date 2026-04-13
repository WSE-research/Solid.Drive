# sharing

## Overview

Low-level ACL management for file sharing. Kept as a separate feature to isolate the WAC protocol details from the file explorer UI logic.

## Contents

| Name | Description |
|---|---|
| **hooks/useAclManager** | Handles all the WAC ACL operations needed to grant and revoke file access. The `SharePanel` component in `file-explorer` is the main consumer |
