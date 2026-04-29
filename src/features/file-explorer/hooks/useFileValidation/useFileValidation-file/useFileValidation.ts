/**
 * React hook for validating file metadata against TBox shapes.
 *
 * @packageDocumentation
 */

import { useState, useEffect } from "react";
import { loadTBox, type ValidationResult } from "@/infrastructure/validation/tboxValidator";
import { validateFile } from "@/infrastructure/validation/validateFile";

/**
 * Return value from the useFileValidation hook.
 *
 * @public
 */
interface UseFileValidationReturn {
  /** Validation result with violations, or null if not ready. */
  validation: ValidationResult | null;
  /** Error message if TBox loading failed, or null. */
  tboxError: string | null;
  /** True once TBox is loaded and validation is ready. */
  isReady: boolean;
}

/**
 * Hook to validate file metadata against TBox shapes.
 *
 * @remarks
 * Loads TBox on mount and validates whenever inputs change.
 *
 * @param file - File to validate
 * @param title - User-provided title
 * @param description - User-provided description
 * @param webId - Publisher's WebID
 * @returns Object with validation result, error state, and ready flag
 *
 * @public
 */
export function useFileValidation(
  file: File | undefined,
  title: string,
  description: string,
  webId: string | undefined
): UseFileValidationReturn {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [tboxError, setTboxError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Load TBox once on mount; only track success/error here.
  useEffect(() => {
    let cancelled = false;
    void loadTBox()
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
          setTboxError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setTboxError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Validate whenever form state changes; defer to the pure validateFile helper.
  useEffect(() => {
    if (!isReady || !file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValidation(null);
      return;
    }
    let cancelled = false;
    void validateFile(file, title, description, webId ?? "")
      .then((result) => {
        if (!cancelled) setValidation(result);
      })
      .catch(() => {
        if (!cancelled) setValidation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, file, title, description, webId]);

  return {
    validation,
    tboxError,
    isReady,
  };
}
