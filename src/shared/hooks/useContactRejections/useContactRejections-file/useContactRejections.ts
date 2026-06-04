/**
 * @packageDocumentation
 * Tracks the outcome of the viewer's outgoing access requests by reading
 * the approval and rejection notices the owner posts to the viewer's
 * inbox. Refetched on focus/visibility so a decision made by the owner in
 * another window shows up without a manual reload — the requester side
 * stays in step with the owner instead of being frozen at its first read.
 */

import { useState, useEffect, useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { discoverInboxUri, listOutcomeNotifications } from "@/infrastructure/inbox/inboxAccess";
import type { AccessApproval, AccessRejection } from "@/infrastructure/inbox/inboxAccess";

interface UseContactRejectionsReturn {
  /** Targets the owner denied, keyed by the request's accessTo. */
  fileRejections: Map<string, AccessRejection>;
  /** Targets the owner approved, keyed by the request's accessTo. */
  fileApprovals: Map<string, AccessApproval>;
  /** Drops a target's outcome locally after its notice has been deleted. */
  handleClearRejection: (accessTo: string) => void;
}

const toMap = <T extends { accessTo: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.accessTo, item]));

/**
 * Reads the viewer's access-request outcomes from their inbox and keeps
 * them current on focus.
 *
 * @param viewerWebId - WebID of the current user whose inbox to read
 *
 * @public
 */
export function useContactRejections(viewerWebId: string): UseContactRejectionsReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [fileRejections, setFileRejections] = useState<Map<string, AccessRejection>>(new Map());
  const [fileApprovals, setFileApprovals] = useState<Map<string, AccessApproval>>(new Map());

  const loadOutcomes = useCallback(
    async (isActive: () => boolean = () => true) => {
      if (!viewerWebId) return;
      try {
        const inboxUri = await discoverInboxUri(viewerWebId, solidFetch);
        const { approvals, rejections } = await listOutcomeNotifications(inboxUri, solidFetch);
        if (!isActive()) return;
        setFileRejections(toMap(rejections));
        setFileApprovals(toMap(approvals));
      } catch {
        return;
      }
    },
    [viewerWebId, solidFetch],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      await loadOutcomes(() => active);
    })();
    return () => {
      active = false;
    };
  }, [loadOutcomes]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void loadOutcomes();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadOutcomes]);

  const handleClearRejection = useCallback((accessTo: string) => {
    setFileRejections((prev) => {
      if (!prev.has(accessTo)) return prev;
      const next = new Map(prev);
      next.delete(accessTo);
      return next;
    });
    setFileApprovals((prev) => {
      if (!prev.has(accessTo)) return prev;
      const next = new Map(prev);
      next.delete(accessTo);
      return next;
    });
  }, []);

  return { fileRejections, fileApprovals, handleClearRejection };
}
