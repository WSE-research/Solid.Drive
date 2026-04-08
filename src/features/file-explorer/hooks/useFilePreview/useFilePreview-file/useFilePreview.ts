/**
 * @packageDocumentation
 * Creates a blob URL for previewing binary files.
 */

import { useMemo, useEffect } from "react";
import { useResource } from "@ldo/solid-react";
import { isBinary } from "@/infrastructure/solid/resourceGuards";

interface UseFilePreviewReturn {
  previewUrl: string | undefined;
}

/**
 * Loads a binary resource and returns an object URL for display.
 *
 * @remarks
 * Automatically revokes the URL on cleanup to prevent memory leaks.
 *
 * @param binaryUri - URI of the binary resource to preview
 *
 * @public
 */
export function useFilePreview(binaryUri: string | undefined): UseFilePreviewReturn {
  const binaryResource = useResource(binaryUri);

  const previewUrl = useMemo(() => {
    if (!isBinary(binaryResource) || !binaryResource.isBinary()) return undefined;
    return URL.createObjectURL(binaryResource.getBlob());
  }, [binaryResource]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return { previewUrl };
}
