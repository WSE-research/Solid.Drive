/**
 * Shared status control for an outgoing access request: a coloured pill
 * reading the request's outcome, plus an optional re-request button for
 * settled (approved or denied) outcomes.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";

/**
 * Props for {@link RequestStatusPill}.
 *
 * @public
 */
export interface RequestStatusPillProps {
  /** Outcome the pill reflects, used as the `request-status--*` modifier. */
  status: "approved" | "denied" | "pending";
  /** Text shown inside the pill. */
  label: string;
  /** Label for the re-request button; omit for a status-only pill. */
  requestAgainLabel?: string;
  /** Re-request handler; omit for a status-only pill. */
  onRequestAgain?: () => void;
}

/**
 * Renders the request status pill and, when a re-request handler is
 * supplied, a ghost button to send the request again.
 *
 * @public
 */
export const RequestStatusPill: FunctionComponent<RequestStatusPillProps> = ({
  status,
  label,
  requestAgainLabel,
  onRequestAgain,
}) => (
  <>
    <span className={`request-status request-status--${status}`}>{label}</span>
    {onRequestAgain && requestAgainLabel ? (
      <button className="btn btn--ghost btn--small" onClick={onRequestAgain}>
        {requestAgainLabel}
      </button>
    ) : null}
  </>
);
