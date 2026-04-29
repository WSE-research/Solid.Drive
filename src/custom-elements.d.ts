import type { HTMLAttributes } from "react";

type El = HTMLAttributes<HTMLElement> & { key?: React.Key | null };

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
    }
  }
}
