/**
 * Bulk upload pipeline backing the multi-file drag-and-drop path.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLdo } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { isSolidContainer } from "@/infrastructure/solid/resourceGuards";
import { useFileUpload } from "@/features/file-explorer/hooks/useFileUpload";
import { validateFile } from "@/infrastructure/validation/validateFile";
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

/**
 * Owns the bulk-upload tray queue, processing items one at a time so the
 * catalog SPARQL PATCH never races on the same container.
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
  const isProcessingRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const catalogEntriesRef = useRef(catalogEntries);
  catalogEntriesRef.current = catalogEntries;
  const catalogUriRef = useRef(catalogUri);
  catalogUriRef.current = catalogUri;
  const profileHasCatalogRef = useRef(profileHasCatalog);
  profileHasCatalogRef.current = profileHasCatalog;
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    const handledIds = new Set<string>();
    try {
      const findNext = (): UploadQueueItem | undefined =>
        itemsRef.current.find((item) => item.status === "queued" && !handledIds.has(item.id));
      let candidate = findNext();
      while (candidate) {
        const next: UploadQueueItem = candidate;
        handledIds.add(next.id);

        const existingEntry = findExistingEntryByFilename(catalogEntriesRef.current, next.file.name);
        if (existingEntry) {
          if (cancelledRef.current) return;
          const folderName = extractFolderName(existingEntry.uri);
          updateItem(next.id, {
            status: "error",
            error: translate("fileExplorer.uploadDuplicate", { name: next.file.name, folder: folderName }),
          });
          await Promise.resolve();
          candidate = findNext();
          continue;
        }

        updateItem(next.id, { status: "uploading", error: undefined });

        let validation;
        try {
          validation = await validateFile(next.file, "", "", "");
        } catch {
          validation = null;
        }

        if (cancelledRef.current) return;

        if (!validation || !validation.valid) {
          const message = validation?.violations[0]?.label ?? "Validation failed";
          updateItem(next.id, { status: "error", error: message });
        } else {
          const container = getResource(next.destinationUri);
          if (!isSolidContainer(container)) {
            updateItem(next.id, { status: "error", error: "Destination is not a container" });
          } else {
            try {
              await upload({
                file: next.file,
                title: next.file.name,
                description: "",
                mainContainer: container as SolidContainer,
                catalogUri: catalogUriRef.current,
                profileHasCatalog: profileHasCatalogRef.current,
              });
              if (!cancelledRef.current) updateItem(next.id, { status: "success" });
            } catch (err) {
              if (cancelledRef.current) return;
              const message = err instanceof Error ? err.message : String(err);
              updateItem(next.id, { status: "error", error: message });
            }
          }
        }

        // Allow setItems to flush so itemsRef.current reflects latest snapshot.
        await Promise.resolve();
        candidate = findNext();
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [updateItem, getResource, upload, translate]);

  useEffect(() => {
    if (items.some((item) => item.status === "queued")) {
      void processQueue();
    }
  }, [items, processQueue]);

  const enqueueInstant = useCallback((files: File[], destinationUri: string, destinationLabel: string) => {
    if (files.length === 0) return;
    const newItems: UploadQueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      destinationUri,
      destinationLabel,
      status: "queued",
    }));
    setItems((current) => [...current, ...newItems]);
  }, []);

  const dismiss = useCallback((id: string) => removeItem(id), [removeItem]);

  const retry = useCallback((id: string) => {
    updateItem(id, { status: "queued", error: undefined });
  }, [updateItem]);

  const hasActive = useMemo(
    () => items.some((item) => item.status === "queued" || item.status === "uploading"),
    [items]
  );

  return { items, enqueueInstant, dismiss, retry, hasActive };
}
