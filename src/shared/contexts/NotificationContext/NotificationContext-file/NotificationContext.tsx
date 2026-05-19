/**
 * Notification provider component. Renders the toast container and the
 * confirmation dialog overlay, exposing the toast and confirm API
 * through a React context. The hook and context object live in the
 * sibling notificationContext.ts file so this file exports a component
 * only, which is required for React Fast Refresh to hot-replace edits
 * cleanly.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { FunctionComponent, ReactNode, MouseEvent } from "react";
import { Toast } from "@/shared/components/Toast";
import { NotificationContext } from "./notificationContextValue";
import type { NotificationContextValue, ToastType } from "./notificationContextValue";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmDialogState {
  message: string;
  resolve: (value: boolean) => void;
}

const TOAST_AUTO_DISMISS_MS = 5000;

interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * Generates a collision-resistant toast id without pulling in a UUID
 * dependency for what is purely a UI key.
 *
 * @internal
 */
function nextToastId(): string {
  return `${Date.now()}-${Math.random()}`;
}

/**
 * Provider component for notification context. Renders the toast
 * container and confirmation dialog overlay.
 *
 * @public
 */
export const NotificationProvider: FunctionComponent<NotificationProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextToastId();
    setToasts((current) => [...current, { id, message, type }]);
    const timer = setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const showError = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, "info"), [showToast]);

  const confirm = useCallback(
    (message: string): Promise<boolean> =>
      new Promise((resolve) => setConfirmDialog({ message, resolve })),
    [],
  );

  const resolveConfirm = useCallback(
    (result: boolean) => {
      if (!confirmDialog) return;
      confirmDialog.resolve(result);
      setConfirmDialog(null);
    },
    [confirmDialog],
  );

  const handleConfirmYes = () => resolveConfirm(true);
  const handleConfirmNo = () => resolveConfirm(false);
  const stopOverlayClick = (event: MouseEvent) => event.stopPropagation();

  const value = useMemo<NotificationContextValue>(
    () => ({ showToast, showError, showSuccess, showInfo, confirm }),
    [showToast, showError, showSuccess, showInfo, confirm],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <toast-container>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </toast-container>

      {confirmDialog && (
        <confirm-overlay onClick={handleConfirmNo}>
          <confirm-dialog onClick={stopOverlayClick}>
            <p className="confirm-dialog__message">{confirmDialog.message}</p>
            <confirm-dialog-actions>
              <button className="btn btn--primary" onClick={handleConfirmYes}>
                Confirm
              </button>
              <button className="btn btn--ghost" onClick={handleConfirmNo}>
                Cancel
              </button>
            </confirm-dialog-actions>
          </confirm-dialog>
        </confirm-overlay>
      )}
    </NotificationContext.Provider>
  );
};
