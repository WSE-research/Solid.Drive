/**
 * The NotificationProvider component for toasts and confirmation dialogs.
 *
 * The context object and the useNotifications hook live alongside this in
 * notificationContext.ts. They are kept in a separate file so that this
 * file exports only a component, which is what React Fast Refresh needs.
 *
 * @packageDocumentation
 */

import { useState, useCallback, type ReactNode, type FunctionComponent } from "react";
import { Toast } from "@/shared/components/Toast";
import { NotificationContext, type NotificationContextType, type ToastType } from "./notifications";

/**
 * Internal toast message with unique ID.
 */
type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

/**
 * Props for the NotificationProvider component.
 */
type NotificationProviderProps = {
  children: ReactNode;
};

/**
 * Internal state for confirmation dialog.
 */
type ConfirmDialogState = {
  message: string;
  resolve: (value: boolean) => void;
} | null;

/**
 * Provider component for notification context.
 * Renders toast container and confirmation dialog overlay.
 *
 * @public
 */
export const NotificationProvider: FunctionComponent<NotificationProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const showError = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, "info"), [showToast]);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback((result: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(result);
      setConfirmDialog(null);
    }
  }, [confirmDialog]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const handleConfirmYes = () => handleConfirm(true);
  const handleConfirmNo = () => handleConfirm(false);
  const handleDialogClick = (e: React.MouseEvent) => e.stopPropagation();

  const value: NotificationContextType = {
    showToast,
    showError,
    showSuccess,
    showInfo,
    confirm,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast container */}
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

      {/* Confirmation dialog */}
      {confirmDialog && (
        <confirm-overlay onClick={handleConfirmNo}>
          <confirm-dialog onClick={handleDialogClick}>
            <p className="confirm-dialog__message">{confirmDialog.message}</p>
            <confirm-dialog-actions>
              <button
                className="btn btn--primary"
                onClick={handleConfirmYes}
              >
                Confirm
              </button>
              <button
                className="btn btn--ghost"
                onClick={handleConfirmNo}
              >
                Cancel
              </button>
            </confirm-dialog-actions>
          </confirm-dialog>
        </confirm-overlay>
      )}
    </NotificationContext.Provider>
  );
};
