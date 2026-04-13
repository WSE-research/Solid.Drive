# App

## Overview

Root component that bootstraps the application. Wraps everything in the Solid auth provider and notification provider, then renders the header and main layout.

## Layout

| Condition | Renders |
|---|---|
| Always | `<BrowserSolidLdoProvider>` wrapping `<NotificationProvider>` wrapping `<Header />` |
| Logged in | `<ProfileSidebar />` and `<FileExplorer />` |
| Logged out | `<FileExplorer />` only |
