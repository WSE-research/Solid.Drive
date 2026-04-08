/**
 * Notification context for toasts and confirmation dialogs.
 *
 * @packageDocumentation
 */

import { createContext, useContext, useState, useCallback, type ReactNode, type FunctionComponent } from "react";
import { Toast } from "@/shared/components/Toast";

/**
 * Toast notification type.
 */
type ToastType = "info" | "error" | "success";

/**
 * Internal toast message with unique ID.
 */
type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

/**
 * Notification context value providing toast and confirm functions.
 */
type NotificationContextType = {
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Hook to access notification functions.
 * Must be used within NotificationProvider.
 *
 * @returns Notification context functions
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
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="confirm-overlay" onClick={() => handleConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-dialog__message">{confirmDialog.message}</p>
            <div className="confirm-dialog__actions">
              <button
                className="btn btn--primary"
                onClick={() => handleConfirm(true)}
              >
                Confirm
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => handleConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
