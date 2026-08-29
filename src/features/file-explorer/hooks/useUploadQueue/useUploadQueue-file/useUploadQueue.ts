/**
 * Bulk upload pipeline backing the multi-file drag-and-drop path.
 *
 * @remarks
 * Transfers run concurrently up to a bounded pool; only the catalog write is
 * serialised. See the module notes on {@link useUploadQueue} for why the queue
 * is driven from a ref rather than from React state.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLdo } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { isSolidContainer } from "@/infrastructure/solid/resourceGuards";
import { useFileUpload } from "@/features/file-explorer/hooks/useFileUpload";
import { containerSlugFor } from "@/features/file-explorer/services/containerSlug";
import { createMutex, createTransferPool } from "@/features/file-explorer/services/transferPool";
import { validateFile } from "@/infrastructure/validation/validateFile";
import { ENV } from "@/config";
import type { SolidContainer } from "@ldo/connected-solid";
import type { CatalogEntry } from "@/types";

/**
 * Status of one upload row in the tray.
 *
 * @public
 */
export type UploadStatus = "queued" | "uploading" | "success" | "error";

/**
 * Single row in the upload tray.
 *
 * @public
 */
export interface UploadQueueItem {
  id: string;
  file: File;
  destinationUri: string;
  destinationLabel: string;
  status: UploadStatus;
  error?: string;
}

/**
 * Public surface of the hook.
 *
 * @public
 */
export interface UseUploadQueueReturn {
  items: UploadQueueItem[];
  enqueueInstant(files: File[], destinationUri: string, destinationLabel: string): void;
  dismiss(id: string): void;
  retry(id: string): void;
  hasActive: boolean;
}

/**
 * Finds a catalog entry whose title, or whose `accessURL` final segment,
 * matches `fileName`. Lets the queue reject a duplicate before any upload
 * runs, since the catalog SPARQL PATCH would otherwise return 500.
 */
function findExistingEntryByFilename(entries: CatalogEntry[], fileName: string): CatalogEntry | undefined {
  return entries.find((entry) => {
    if (entry.title === fileName) return true;
    try {
      return decodeURIComponent(entry.accessURL).endsWith(`/${fileName}`);
    } catch {
      return entry.accessURL.endsWith(`/${encodeURIComponent(fileName)}`);
    }
  });
}

/**
 * Returns the parent folder name for a per-file container instance URI
 * such as `https://pod.example/backup/duplicate.txt/index.ttl`. The
 * filename-shaped slug sits one level above the index document, so the
 * folder name is two segments above the trailing slash.
 */
function extractFolderName(instanceUri: string): string {
  const trimmed = instanceUri.replace(/\/index\.ttl$/, "").replace(/\/$/, "");
  const segments = trimmed.split("/").filter(Boolean);
  // Drop the per-file container slug; the folder name sits one level above.
  segments.pop();
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

/** Key under which two files would fight over the same per-file container. */
function collisionKey(destinationUri: string, fileName: string): string {
  return `${destinationUri} ${containerSlugFor(fileName)}`;
}

/**
 * Owns the bulk-upload tray queue.
 *
 * @remarks
 * **Concurrency.** Transfers run through a {@link createTransferPool} of
 * `ENV.uploadConcurrency`. Creating the per-file container, PUTting the binary
 * and writing `index.ttl` all touch only that file's own subtree, so they
 * parallelise cleanly; the catalog append does not, and is serialised through a
 * mutex passed into `upload` as `withCatalogLock`. The mutex is created once per
 * hook instance, which is the right scope: one tray owns one catalog.
 *
 * **Why the queue lives in a ref.** The model is a `Map` in a ref, mirrored into
 * React state purely for rendering. Scheduling off React state does not work
 * here: an item's status has to be claimed in the same synchronous tick it is
 * picked, or two passes of the scheduler both see it as `queued` and start it
 * twice. React state is not readable synchronously after a set, and awaiting a
 * microtask does not guarantee a commit — the previous implementation's
 * `await Promise.resolve()` "let setItems flush" comment relied on exactly that,
 * and combined with a `handledIds` set that outlived the drain it meant an item
 * retried or enqueued while a drain was in flight could be stranded in `queued`
 * forever. Driving from the ref removes the class of bug rather than the
 * instance.
 *
 * @public
 */
export function useUploadQueue(
  catalogUri: string,
  profileHasCatalog: boolean,
  catalogEntries: CatalogEntry[]
): UseUploadQueueReturn {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const { upload } = useFileUpload();
  const { getResource } = useLdo();
  const [translate] = useTranslation();

  /** Authoritative model. Insertion-ordered, so the tray keeps enqueue order. */
  const modelRef = useRef(new Map<string, UploadQueueItem>());
  /** Ids handed to the pool and not yet finished; guards against double-start. */
  const inFlightRef = useRef(new Set<string>());
  /**
   * Container slugs claimed by this tray, so two files in one batch that map to
   * the same slug cannot both pass the duplicate check. The catalog prop cannot
   * cover this: it only refreshes after a round trip, so within a batch it is
   * always at least one upload stale.
   */
  const claimedSlugsRef = useRef(new Set<string>());
  /**
   * Slugs under which something was actually written. Kept separately from the
   * model because a dismissed row leaves no model entry, and "dismissed" must
   * not be mistaken for "failed" when deciding whether the slug is free again.
   */
  const succeededSlugsRef = useRef(new Set<string>());

  const poolRef = useRef(createTransferPool(ENV.uploadConcurrency));
  const catalogMutexRef = useRef(createMutex());

  const catalogEntriesRef = useRef(catalogEntries);
  const catalogUriRef = useRef(catalogUri);
  const profileHasCatalogRef = useRef(profileHasCatalog);
  useEffect(() => {
    catalogEntriesRef.current = catalogEntries;
    catalogUriRef.current = catalogUri;
    profileHasCatalogRef.current = profileHasCatalog;
  }, [catalogEntries, catalogUri, profileHasCatalog]);

  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  /** Pushes the model into React state so the tray re-renders. */
  const publish = useCallback(() => {
    if (cancelledRef.current) return;
    setItems([...modelRef.current.values()]);
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    const current = modelRef.current.get(id);
    if (!current) return;
    modelRef.current.set(id, { ...current, ...patch });
    publish();
  }, [publish]);

  /**
   * Runs one item end to end.
   *
   * Never throws — every failure lands on the row instead. The whole body is
   * wrapped, not only the upload call: `getResource` can throw too, and an
   * escaping rejection would leave the row stuck on "uploading" forever, so
   * `hasActive` stays true and the tray never closes, with nothing to show for
   * it but an unhandled rejection in the console.
   */
  const runItem = useCallback(async (item: UploadQueueItem) => {
    // The pool may have queued this item for a while, and the user can have
    // dismissed it meanwhile. A dismissed transfer must not still land on the
    // Pod, where it would leave a file and a catalog entry with no trace in
    // the UI.
    if (!modelRef.current.has(item.id)) return;

    patchItem(item.id, { status: "uploading", error: undefined });

    try {
      let validation;
      try {
        validation = await validateFile(item.file, "", "", "");
      } catch {
        validation = null;
      }
      if (cancelledRef.current) return;

      if (!validation || !validation.valid) {
        patchItem(item.id, {
          status: "error",
          error: validation?.violations[0]?.label ?? "Validation failed",
        });
        return;
      }

      const container = getResource(item.destinationUri);
      if (!isSolidContainer(container)) {
        patchItem(item.id, { status: "error", error: "Destination is not a container" });
        return;
      }

      await upload({
        file: item.file,
        title: item.file.name,
        description: "",
        mainContainer: container as SolidContainer,
        catalogUri: catalogUriRef.current,
        profileHasCatalog: profileHasCatalogRef.current,
        withCatalogLock: (section) => catalogMutexRef.current.run(section),
      });
      succeededSlugsRef.current.add(collisionKey(item.destinationUri, item.file.name));
      if (!cancelledRef.current) patchItem(item.id, { status: "success" });
    } catch (err) {
      if (cancelledRef.current) return;
      patchItem(item.id, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [patchItem, getResource, upload]);

  /**
   * Hands every unclaimed queued item to the pool. Safe to call as often as
   * anything changes: the pool bounds how many actually run, and `inFlightRef`
   * makes a second call a no-op for items already handed over.
   */
  const pump = useCallback(() => {
    for (const item of [...modelRef.current.values()]) {
      if (item.status !== "queued" || inFlightRef.current.has(item.id)) continue;

      const existingEntry = findExistingEntryByFilename(catalogEntriesRef.current, item.file.name);
      if (existingEntry) {
        patchItem(item.id, {
          status: "error",
          error: translate("fileExplorer.uploadDuplicate", {
            name: item.file.name,
            folder: extractFolderName(existingEntry.uri),
          }),
        });
        continue;
      }

      const key = collisionKey(item.destinationUri, item.file.name);
      if (claimedSlugsRef.current.has(key)) {
        patchItem(item.id, {
          status: "error",
          error: translate("fileExplorer.uploadDuplicate", {
            name: item.file.name,
            folder: item.destinationLabel,
          }),
        });
        continue;
      }
      claimedSlugsRef.current.add(key);

      // Claimed synchronously, before any await, so a second pump in the same
      // tick cannot pick the same item.
      inFlightRef.current.add(item.id);
      void poolRef.current
        .run(() => runItem(item))
        .finally(() => {
          inFlightRef.current.delete(item.id);
          // Release the slug only if nothing was written under it, so a retry
          // can proceed. `succeededSlugsRef` is consulted rather than the
          // model, because a dismissed row is simply absent from the model and
          // would otherwise be indistinguishable from a failed one -- which
          // would free a slug whose container exists on the Pod, and let the
          // next upload of that name overwrite it.
          if (!succeededSlugsRef.current.has(key)) {
            claimedSlugsRef.current.delete(key);
          }
        });
    }
  }, [patchItem, runItem, translate]);

  const enqueueInstant = useCallback((files: File[], destinationUri: string, destinationLabel: string) => {
    if (files.length === 0) return;
    for (const file of files) {
      const id = crypto.randomUUID();
      modelRef.current.set(id, { id, file, destinationUri, destinationLabel, status: "queued" });
    }
    publish();
    pump();
  }, [publish, pump]);

  const dismiss = useCallback((id: string) => {
    modelRef.current.delete(id);
    publish();
  }, [publish]);

  const retry = useCallback((id: string) => {
    // Only rows that finished can be retried; re-queueing a running one would
    // double-start it once the pool frees its slot.
    if (inFlightRef.current.has(id)) return;
    patchItem(id, { status: "queued", error: undefined });
    pump();
  }, [patchItem, pump]);

  const hasActive = useMemo(
    () => items.some((item) => item.status === "queued" || item.status === "uploading"),
    [items]
  );

  return { items, enqueueInstant, dismiss, retry, hasActive };
}
