/**
 * @packageDocumentation
 * Tracks folder navigation state and breadcrumb history.
 */

import { useState, useCallback } from "react";
import type { SolidContainerUri } from "@ldo/connected-solid";

type Breadcrumb = { label: string; uri: SolidContainerUri };

interface UseNavigationReturn {
  currentUri: SolidContainerUri | undefined;
  breadcrumbs: Breadcrumb[];
  setCurrentUri: (uri: SolidContainerUri | undefined) => void;
  setBreadcrumbs: React.Dispatch<React.SetStateAction<Breadcrumb[]>>;
  handleNavigate: (uri: string) => void;
  handleBreadcrumbClick: (index: number, uri: SolidContainerUri) => void;
}

/**
 * Manages current folder URI and breadcrumb trail for file explorer.
 *
 * @param initialUri - Starting container URI
 * @param initialLabel - Label for the root breadcrumb
 *
 * @public
 */
export function useNavigation(initialUri?: SolidContainerUri, initialLabel?: string): UseNavigationReturn {
  const [currentUri, setCurrentUri] = useState<SolidContainerUri | undefined>(initialUri);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>(
    initialUri && initialLabel ? [{ label: initialLabel, uri: initialUri }] : []
  );

  const handleNavigate = useCallback((uri: string) => {
    const label = decodeURIComponent(uri.replace(/\/$/, "").split("/").pop() || uri);
    setBreadcrumbs((prev) => [...prev, { label, uri: uri as SolidContainerUri }]);
    setCurrentUri(uri as SolidContainerUri);
  }, []);

  const handleBreadcrumbClick = useCallback((index: number, uri: SolidContainerUri) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentUri(uri);
  }, []);

  return {
    currentUri,
    breadcrumbs,
    setCurrentUri,
    setBreadcrumbs,
    handleNavigate,
    handleBreadcrumbClick,
  };
}
