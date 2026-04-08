/**
 * Toast notification component.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";

/**
 * Props for the Toast component.
 */
type ToastProps = {
  message: string;
  type?: "info" | "error" | "success";
  onDismiss?: () => void;
};

/**
 * Displays a temporary notification toast with optional dismiss button.
 *
 * @public
 */
export const Toast: FunctionComponent<ToastProps> = ({
  message,
  type = "info",
  onDismiss,
}) => (
  <div className={`toast toast--${type}`} role="alert">
    <span className="toast__message">{message}</span>
    {onDismiss && (
      <button className="toast__dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    )}
  </div>
);
