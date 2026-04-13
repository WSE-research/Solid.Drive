/**
 * React hook for loading file type definitions from TBox ontology.
 *
 * @packageDocumentation
 */

import { useState, useEffect } from "react";
import {
  loadFileTypes,
  getAllFileTypes,
  getFileTypesSync,
  type FileTypeDef,
} from "@/infrastructure/validation/fileTypeRegistry";

/**
 * Return value from the useFileTypes hook.
 *
 * @public
 */
export interface UseFileTypesResult {
  /** Array of loaded file type definitions. */
  fileTypes: FileTypeDef[];
  /** True while file types are being loaded. */
  loading: boolean;
  /** Error message if loading failed, or null. */
  error: string | null;
  /** True once file types have been successfully loaded. */
  loaded: boolean;
}

/**
 * Hook to load and access file type definitions from the TBox ontology.
 *
 * @remarks
 * Handles async loading of file types and provides fallback types while loading.
 * Caches the result so subsequent calls don't trigger additional fetches.
 *
 * @param tboxUri - Optional custom TBox URI (defaults to /tbox.ttl)
 * @returns Object with fileTypes array, loading state, error, and loaded flag
 *
 * @example
 * ```tsx
 * function FileTypeSelector() {
 *   const { fileTypes, loading } = useFileTypes();
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <select>
 *       {fileTypes.map(type => (
 *         <option key={type.id} value={type.uri}>
 *           {type.label}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 *
 * @public
 */
export function useFileTypes(tboxUri?: string): UseFileTypesResult {
  const [fileTypes, setFileTypes] = useState<FileTypeDef[]>(() => {
    // Initialize with cached types if available
    return getFileTypesSync() ?? getAllFileTypes();
  });
  const [loading, setLoading] = useState(() => getFileTypesSync() === null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(() => getFileTypesSync() !== null);

  useEffect(() => {
    // If already cached, no need to load
    if (getFileTypesSync() !== null) {
      setFileTypes(getFileTypesSync()!);
      setLoaded(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const types = await loadFileTypes(tboxUri);
        if (!cancelled) {
          setFileTypes(types);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file types");
          setFileTypes(getAllFileTypes());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tboxUri]);

  return { fileTypes, loading, error, loaded };
}
