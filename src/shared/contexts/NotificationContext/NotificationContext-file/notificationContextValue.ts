/**
 * @packageDocumentation
 * Notification context object and hook. Split out from the provider
 * component file so React Fast Refresh treats every edit to the
 * provider as a hot replacement instead of a full page reload.
 */

import { createContext, useContext } from "react";

/**
 * Toast notification severity.
 *
 * @public
 */
export type ToastType = "info" | "error" | "success";

/**
 * Notification context value providing toast and confirm functions.
 *
 * @public
 */
export interface NotificationContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
}

/**
 * Underlying React context. Exposed only so the provider component
 * can populate it — consumers should call {@link useNotifications}.
 *
 * @internal
 */
export const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

/**
 * Hook to access notification functions. Must be used within
 * `NotificationProvider`.
 *
 * @returns Notification context functions
 * @throws Error if used outside `NotificationProvider`
 *
 * @public
 */
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
