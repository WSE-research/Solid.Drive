/**
 * React hook for validating file metadata against TBox shapes.
 *
 * @packageDocumentation
 */

import { useState, useEffect } from "react";
import { loadTBox, validateMetadata, type ShapeDefinition, type ValidationResult } from "@/infrastructure/validation/tboxValidator";
import { resolveClass } from "@/infrastructure/validation/fileTypeRegistry";

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
  const [tbox, setTbox] = useState<{ shapes: Map<string, ShapeDefinition>; parents: Map<string, string[]> } | null>(null);
  const [tboxError, setTboxError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Load TBox once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadTBox();
        if (!cancelled) setTbox(result);
      } catch (err) {
        if (!cancelled) setTboxError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Validate whenever form state or TBox changes
  useEffect(() => {
    if (!tbox || !file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValidation(null);
      return;
    }
    const classUri = resolveClass(file.type);
    /* v8 ignore next */
    const typeLocalName = classUri.split(/[#/]/).pop() ?? "DigitalDocument";
    const snapshot: Record<string, unknown> = {
      name: title.trim() || file.name,
      description: description.trim() || undefined,
      encodingFormat: file.type || undefined,
      contentSize: file.size.toString(),
      uploadDate: new Date().toISOString(),
      publisher: { "@id": webId ?? "" },
      type: [{ "@id": typeLocalName }],
    };
    setValidation(validateMetadata(snapshot, classUri, tbox.shapes, tbox.parents));
  }, [tbox, file, title, description, webId]);

  return {
    validation,
    tboxError,
    isReady: !!tbox,
  };
}
