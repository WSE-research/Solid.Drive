/**
 * @packageDocumentation
 * Shared confirm-then-delete flow for anything that soft-deletes a file
 * with a hard-delete fallback: a re-entrancy guard, the confirm prompt,
 * running the delete, and reporting the result. Previously duplicated
 * almost verbatim between `FileCard` and `useOneDriveActions`.
 */

import { useCallback, useRef } from "react";
import { useNotifications } from "@/shared/contexts/NotificationContext";

/**
 * Result shape both {@link deleteResource} and {@link softDeleteFile}
 * already return, so either can be passed straight through as `run`.
 */
export type GuardedDeleteResult = { ok: true } | { ok: false; reason: string };

/**
 * Arguments for {@link useGuardedSoftDelete}'s `runGuardedDelete`.
 *
 * @public
 */
export interface RunGuardedDeleteArgs {
  /** Confirm-dialog message, already resolved for whichever branch will run. */
  confirmMessage: string;
  /** Prefix shown before the failure reason, e.g. "Delete failed". */
  failedMessage: string;
  /** Success toast message. Omitted entirely when there's nothing to say beyond the UI updating. */
  successMessage?: string;
  /** Runs once, after a successful delete and its toast (if any). */
  onSuccess?: () => void;
  /** The delete itself — soft-delete, hard-delete, whichever the caller already decided on. */
  run: () => Promise<GuardedDeleteResult>;
}

/**
 * Return shape of {@link useGuardedSoftDelete}.
 *
 * @public
 */
export interface UseGuardedSoftDeleteReturn {
  runGuardedDelete: (args: RunGuardedDeleteArgs) => Promise<void>;
}

/**
 * Guards a delete behind a single in-flight lock, confirms with the user,
 * runs the caller-supplied delete, and reports the outcome as a toast.
 *
 * The lock is set synchronously, before the confirm await, so a second
 * click landing while the confirm dialog (or the delete itself) is still
 * in flight is a no-op instead of opening a second dialog or firing a
 * second delete on the same resource. A thrown or rejected `run()` is
 * reported the same way as an `{ ok: false }` result, so a delete never
 * fails silently.
 *
 * @public
 */
export function useGuardedSoftDelete(): UseGuardedSoftDeleteReturn {
  const { confirm, showSuccess, showError } = useNotifications();
  const isDeletingRef = useRef(false);

  const runGuardedDelete = useCallback(
    async ({ confirmMessage, failedMessage, successMessage, onSuccess, run }: RunGuardedDeleteArgs) => {
      if (isDeletingRef.current) return;
      isDeletingRef.current = true;

      try {
        const confirmed = await confirm(confirmMessage);
        if (!confirmed) return;

        const result = await run();
        if (!result.ok) {
          showError(`${failedMessage}: ${result.reason}`);
          return;
        }
        if (successMessage) showSuccess(successMessage);
        onSuccess?.();
      } catch (error) {
        showError(`${failedMessage}: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        isDeletingRef.current = false;
      }
    },
    [confirm, showSuccess, showError],
  );

  return { runGuardedDelete };
}
