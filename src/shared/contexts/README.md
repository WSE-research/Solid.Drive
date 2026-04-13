# shared/contexts

## Overview

React context providers and hooks for cross-cutting concerns.

## Contents

| Name | Description |
|---|---|
| **NotificationContext** | Provides `showError`, `showSuccess`, `showInfo`, `showToast`, and `confirm` (async boolean dialog) to any component in the tree |

Wrap the app with `NotificationProvider` and call `useNotifications()` in components.
