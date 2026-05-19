import type { HTMLAttributes, RefAttributes } from "react";

type El = HTMLAttributes<HTMLElement> &
  RefAttributes<HTMLElement> & { key?: React.Key | null };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      // FileCard (previously converted)
      "file-card": El;
      "file-card-header": El;
      "file-card-body": El;
      "file-card-meta": El;
      "file-card-actions": El;
      "file-card-info": El;
      // FileCardInfoPanel
      "file-card-schema": El;
      "file-card-schema-row": El;
      // App
      "app-root": El;
      "app-layout": El;
      // Header
      "site-header-brand": El;
      "auth-logged-in": El;
      "auth-logged-out": El;
      "auth-input-row": El;
      "auth-field": El;
      "auth-provider-row": El;
      // DriveFileList
      "empty-state": El;
      "empty-state-icon": El;
      "file-entry": El;
      // FileExplorer
      "drive-gate": El;
      "drive-gate-icon": El;
      "drive-error": El;
      "drive-error-icon": El;
      "drive-loading": El;
      "files-section-header": El;
      "add-menu": El;
      "add-menu-dropdown": El;
      // NewFolderInput
      "new-folder-input": El;
      // FileUpload
      "file-upload-row": El;
      "file-upload-errors": El;
      "file-upload-footer": El;
      // SharedWithMeSection
      "type-folders": El;
      // SharePanel
      "share-panel": El;
      "share-panel-loading": El;
      "share-panel-row": El;
      "share-panel-name": El;
      // TypeFolder
      "type-folder": El;
      "type-folder-header": El;
      "type-folder-body": El;
      "type-folder-file-row": El;
      "type-folder-file-actions": El;
      // ContactRow
      "contact-row": El;
      "contact-row-actions": El;
      // ContactsList
      "contacts-input-row": El;
      // ProfileCard
      "profile-card": El;
      "profile-card-header": El;
      "profile-card-info": El;
      "profile-card-edit": El;
      "profile-card-actions": El;
      "profile-field": El;
      // ProfileSidebar
      "profile-sidebar-card": El;
      // RequestsPanel
      "requests-panel": El;
      "requests-panel-body": El;
      "requests-panel-loading": El;
      "requests-panel-item": El;
      "requests-panel-requester": El;
      "requests-panel-actions": El;
      // ErrorBoundary
      "error-boundary": El;
      // NotificationContext
      "toast-container": El;
      "confirm-overlay": El;
      "confirm-dialog": El;
      "confirm-dialog-actions": El;
      // SearchInput
      "search-input": El;
      "search-input-clear": El;
      // SearchResults
      "search-results": El;
      // DropZone
      "drop-zone": El;
      "drop-zone-icon": El;
      "drop-zone-label": El;
      // UploadTray
      "upload-tray": El;
      "upload-tray-row": El;
      "upload-tray-row-actions": El;
      // OneDriveLayout
      "onedrive-layout": El;
      "onedrive-view": El;
      "nav-rail": El;
      "rail-bottom-panel": El;
      "top-bar": El;
      "topbar-brand": El;
      "topbar-actions": El;
      "search-slot": El;
      "topbar-search-overlay": El;
      // OneDriveLayout — TopBar dropdown internals
      "topbar-menu-row": El;
      "topbar-menu-profile": El;
      "topbar-menu-profile-info": El;
      "topbar-menu-profile-name": El;
      "topbar-menu-profile-webid": El;
      // OneDriveLayout — page header (title + toolbar row above main)
      "page-header": El;
      "page-header-right": El;
      "selection-actions": El;
      "selection-actions-inline": El;
      "selection-actions-kebab": El;
      // OneDriveLayout — ContextualToolbar
      "contextual-toolbar": El;
      "toolbar-left": El;
      "toolbar-right": El;
      // OneDriveLayout — DetailPanel
      "detail-panel": El;
      "detail-panel-header": El;
      "detail-panel-body": El;
      "detail-panel-empty": El;
      "detail-panel-thumbnail": El;
      "detail-panel-section": El;
      "detail-panel-divider": El;
      "detail-panel-row": El;
      "editable-description": El;
      "has-access-row": El;
      // OneDriveLayout — Filters (TypeFilterChips, PersonNameFilter, SharedFilters)
      "type-filter-chips": El;
      "type-filter-chips-dropdown": El;
      "person-name-filter": El;
      "shared-filters": El;
      // OneDriveLayout — SharedView (legacy with-you list — kept for
      // backwards-compat with classic SharedWithMeSection only)
      "shared-with-you-list": El;
      // OneDriveLayout — SharedView toolbar + table
      "shared-toolbar": El;
      "shared-toolbar-tabs": El;
      "shared-toolbar-chips": El;
      "shared-toolbar-search": El;
      "shared-body": El;
      "shared-files-table": El;
      "shared-files-head": El;
      "shared-files-body": El;
      "shared-files-row": El;
      "shared-files-cell": El;
      "shared-files-name": El;
      // OneDriveLayout — PeopleView (list + detail)
      "people-view-grid": El;
      "people-view-list": El;
      "people-view-detail": El;
      "person-detail-identity": El;
      "people-list": El;
      "people-list-header": El;
      "people-list-body": El;
      "people-list-add": El;
      "person-row": El;
      // OneDriveLayout — RequestsView (cards + states)
      "requests-list": El;
      "requests-list-header": El;
      "requests-list-state": El;
      "requests-list-body": El;
      "request-card": El;
      "request-card-body": El;
      "request-card-actions": El;
      // OneDriveLayout — RecentView (Home — recent files table)
      "recent-toolbar": El;
      "recent-toolbar-chips": El;
      "recent-toolbar-search": El;
      "recent-files-table": El;
      "recent-files-head": El;
      "recent-files-body": El;
      "recent-files-row": El;
      "recent-files-cell": El;
      "recent-files-name": El;
    }
  }
}
