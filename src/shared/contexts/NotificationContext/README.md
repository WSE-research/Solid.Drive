# NotificationContext

## Overview

Provides toasts and confirmation dialogs to the whole app via React context.

## Features

| Feature | Description |
|---|---|
| `useNotifications()` | Returns `{ showError, showSuccess, showInfo, showToast, confirm }` |
| Auto-dismiss | Toasts auto-dismiss after 5 seconds |
| Confirm dialog | `confirm` shows a modal overlay and resolves to `true` (Confirm) or `false` (Cancel) |
| Single dialog | Only one confirm dialog can be open at a time |

## Usage

```ts
const { showError, confirm } = useNotifications();

const confirmed = await confirm("Delete this file?");
if (confirmed) {
  // ...
  showSuccess("Deleted");
} else {
  showError("Something went wrong");
}
```
