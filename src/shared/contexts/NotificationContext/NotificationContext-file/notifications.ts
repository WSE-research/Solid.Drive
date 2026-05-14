/**
 * The React context object and consumer hook for the notification system.
 *
 * These live in their own file, separate from the provider component, so
 * that NotificationContext.tsx exports only a component. A component file
 * that also exports non-components breaks React Fast Refresh, which is what
 * the react-refresh/only-export-components lint rule guards against.
 *
 * @packageDocumentation
 */

import { createContext, useContext } from "react";

/**
 * The kind of toast shown to the user: an informational, error, or success
 * message.
 */
export type ToastType = "info" | "error" | "success";

/**
 * The set of notification functions the context exposes to consumers.
 */
export type NotificationContextType = {
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

/**
 * The context carrying the notification functions. It is undefined until a
 * NotificationProvider is mounted above the consumer.
 */
export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Returns the notification functions from the nearest NotificationProvider.
 * Throws if it is called outside a provider, since there is no safe default
 * for showing toasts or confirmation dialogs.
 *
 * @returns the notification functions
 * @throws Error if used outside NotificationProvider
 *
 * @public
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
