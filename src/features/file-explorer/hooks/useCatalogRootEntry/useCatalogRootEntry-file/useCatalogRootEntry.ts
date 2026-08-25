/**
 * @packageDocumentation
 * Registers the pod's storage root as its own catalog entry, so every
 * hasParent path walk has a defined stopping point.
 */

import { useEffect, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { ensureCatalogRootEntry } from "@/infrastructure/solid/catalog";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";

/** Where the storage root's registration write currently stands. */
export type CatalogRootEntryStatus = "pending" | "succeeded" | "failed";

/**
 * Registers the storage root as its own parentless catalog entry, unless
 * `rootAlreadyPresent` says one is already confirmed to exist.
 *
 * @remarks
 * Notifies on success because this write races `useCatalog`'s own read of
 * the same document, so the cache would otherwise stay stale until an
 * unrelated write happens to invalidate it.
 *
 * @param catalogUri - URI of the user's catalog
 * @param storageRootUri - URI of the pod's storage root
 * @param rootAlreadyPresent - True when the caller has already confirmed the root entry exists
 * @returns Whether the registration write is pending, succeeded, or confirmed failed
 *
 * @public
 */
export function useCatalogRootEntry(
  catalogUri: string | undefined,
  storageRootUri: string | undefined,
  rootAlreadyPresent: boolean
): CatalogRootEntryStatus {
  const { session, fetch: solidFetch } = useSolidAuth();
  const publisherWebId = session.webId;
  // Identifies one registration attempt. A settled result is only trusted
  // when its key still matches the current inputs, so a catalogUri change
  // reads as "pending" again without an effect resetting state by hand.
  const attemptKey = catalogUri && storageRootUri && publisherWebId
    ? `${catalogUri}#${storageRootUri}#${publisherWebId}`
    : undefined;
  const [settledAttempt, setSettledAttempt] = useState<{ key: string; status: "succeeded" | "failed" } | undefined>(undefined);
  const alreadySucceeded = settledAttempt?.key === attemptKey && settledAttempt?.status === "succeeded";

  useEffect(() => {
    if (!catalogUri || !storageRootUri || !publisherWebId || !attemptKey) return;
    if (rootAlreadyPresent || alreadySucceeded) return;
    const key = attemptKey;

    let cancelled = false;
    ensureCatalogRootEntry({
      catalogUri,
      storageRootUri,
      publisherWebId,
      fetch: solidFetch,
    })
      .then(() => {
        notifyCatalogChanged(catalogUri);
        if (!cancelled) setSettledAttempt({ key, status: "succeeded" });
      })
      .catch(() => {
        if (!cancelled) setSettledAttempt({ key, status: "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [catalogUri, storageRootUri, publisherWebId, solidFetch, rootAlreadyPresent, alreadySucceeded, attemptKey]);

  if (rootAlreadyPresent) return "succeeded";
  if (settledAttempt && settledAttempt.key === attemptKey) return settledAttempt.status;
  return "pending";
}
