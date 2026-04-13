# wac

## Overview

Web Access Control (WAC) implementation for Solid resources. WAC is the Solid authorization protocol where permissions are stored in `.acl` files alongside resources.

## Contents

| Name | Description |
|---|---|
| **aclManager** | Discover ACL document URIs from `Link` headers, read current agents, and write new ACL documents |

The `useAclManager` hook in `features/sharing` provides the React interface on top of this module.
