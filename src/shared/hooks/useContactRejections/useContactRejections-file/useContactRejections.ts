/**
 * @packageDocumentation
 * Hook for tracking file access rejections from a contact's inbox.
 */

import { useState, useEffect } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { discoverInboxUri, listRejectionNotifications } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";

interface UseContactRejectionsReturn {
  fileRejections: Map<string, AccessRejection>;
  handleClearRejection: (containerUri: string) => void;
}

/**
 * Fetches rejection notifications from the viewer's inbox and exposes
 * a handler to dismiss individual rejections.
 *
 * @param viewerWebId - WebID of the current user whose inbox to read
 *
 * @public
 */
export function useContactRejections(viewerWebId: string): UseContactRejectionsReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [fileRejections, setFileRejections] = useState<Map<string, AccessRejection>>(new Map());

  useEffect(() => {
    if (!viewerWebId) return;
    let cancelled = false;

    void (async () => {
      try {
        const inboxUri = await discoverInboxUri(viewerWebId, solidFetch);
        const rejectionList = await listRejectionNotifications(inboxUri, solidFetch);
        if (!cancelled) {
          const rejectionMap = new Map(rejectionList.map((rejection) => [rejection.accessTo, rejection]));
          setFileRejections(rejectionMap);
        }
      } catch {
        // inbox not accessible — silently ignore
      }
    })();

    return () => { cancelled = true; };
  }, [viewerWebId, solidFetch]);

  const handleClearRejection = (containerUri: string) => {
    setFileRejections((prev) => {
      const next = new Map(prev);
      next.delete(containerUri);
      return next;
    });
  };

  return { fileRejections, handleClearRejection };
}
