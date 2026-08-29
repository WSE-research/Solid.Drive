/**
 * React hook for uploading files to Solid pods.
 *
 * @remarks
 * Handles file upload, metadata creation, and catalog updates.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import { useLdo, useSolidAuth } from "@ldo/solid-react";
import { CatalogEntryShShapeType } from "@/.ldo/catalogEntry.shapeTypes";
import { isSolidLeaf } from "@/infrastructure/solid/resourceGuards";
import { appendToCatalog, linkCatalogToProfile } from "@/infrastructure/solid/catalog";
import { resolveClass } from "@/infrastructure/validation/fileTypeRegistry";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import type { ContainerCreationResult } from "@/types";
import type { SolidContainer, SolidContainerUri } from "@ldo/connected-solid";
import { INDEX_FILE } from "@/config";
import { containerSlugFor } from "@/features/file-explorer/services/containerSlug";

/**
 * Parameters for uploading a file.
 *
 * @public
 */
interface UploadParams {
  /** The file to upload. */
  file: File;
  /** Human-readable title for the file. */
  title: string;
  /** Optional description of the file. */
  description: string;
  /** Parent container to upload into. */
  mainContainer: SolidContainer;
  /** URI of the catalog to update. */
  catalogUri: string;
  /** Whether the profile already links to the catalog. */
  profileHasCatalog: boolean;
  /**
   * Wraps the catalog write so a caller running several uploads at once can
   * serialise just that part.
   *
   * Everything else an upload does is scoped to the file's own container and is
   * safe to run in parallel. The catalog is not: every upload appends to the
   * same document, and `appendToCatalog` bootstraps a missing one with
   * `404 → PUT empty → PATCH`. Run two of those concurrently against a fresh
   * Pod and both see the 404, both PUT the empty catalog, and the later PUT
   * erases the entry the earlier PATCH just wrote.
   *
   * Defaults to running the section inline, so a lone upload is unaffected.
   */
  withCatalogLock?: <T>(section: () => Promise<T>) => Promise<T>;
}

/**
 * Return value from the useFileUpload hook.
 *
 * @public
 */
interface UseFileUploadReturn {
  /** True while upload is in progress. */
  isUploading: boolean;
  /** Function to trigger file upload. */
  upload: (params: UploadParams) => Promise<void>;
}

/**
 * Hook for uploading files to Solid pods with metadata and catalog management.
 *
 * @remarks
 * Creates a container for the file, uploads the binary, creates RDF metadata,
 * and updates the catalog. Cleans up on failure.
 *
 * @returns Object with isUploading flag and upload function
 *
 * @public
 */
export function useFileUpload(): UseFileUploadReturn {
  const { session, fetch: solidFetch } = useSolidAuth();
  const { createData, commitData } = useLdo();
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async ({
    file,
    title,
    description,
    mainContainer,
    catalogUri,
    profileHasCatalog,
    withCatalogLock = (section) => section(),
  }: UploadParams): Promise<void> => {
    if (!session.webId) throw new Error("Not logged in");
    setIsUploading(true);
    let containerSlug: string | undefined;
    try {
      const classUri = resolveClass(file.type);
      containerSlug = containerSlugFor(file.name);
      const containerUri = `${containerSlug}/` as SolidContainerUri;
      const containerResult = await mainContainer.createChildAndOverwrite(containerUri) as ContainerCreationResult;
      if (containerResult.isError) throw new Error(containerResult.message);
      const fileContainer = containerResult.resource;

      const uploadResult = await fileContainer.uploadChildAndOverwrite(file.name, file, file.type || "application/octet-stream");
      if (uploadResult.isError) {
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        throw new Error(uploadResult.message);
      }

      const indexResource = fileContainer.child(INDEX_FILE);
      if (!isSolidLeaf(indexResource)) {
        const binaryUri = `${mainContainer.uri}${containerSlug}/${file.name}`;
        await solidFetch(binaryUri, { method: "DELETE" }).catch(() => {});
        await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
        throw new Error("Could not create metadata resource.");
      }

      const metadata = createData(CatalogEntryShShapeType, indexResource.uri, indexResource);
      metadata.name = title.trim() || file.name;
      metadata.encodingFormat = file.type || undefined;
      metadata.contentSize = file.size.toString();
      metadata.uploadDate = new Date().toISOString();
      metadata.publisher = { "@id": session.webId };
      if (description.trim()) metadata.description = description.trim();

      const commitResult = await commitData(metadata);
      if (commitResult.isError) throw new Error(`File metadata is invalid — ${commitResult.message}`);

      const binaryUri = `${mainContainer.uri}${containerSlug}/${encodeURIComponent(file.name)}`;
      // Critical section: both calls write documents shared with every other
      // upload, so a concurrent caller serialises from here to the end of the
      // profile link. The rollback stays inside it — releasing the lock before
      // cleaning up would let the next upload observe a half-written catalog.
      await withCatalogLock(async () => {
        try {
          await appendToCatalog({
            catalogUri,
            instanceUri: indexResource.uri,
            binaryUri,
            classUri,
            parentUri: mainContainer.uri,
            mediaType: file.type,
            byteSize: file.size,
            title: title.trim() || file.name,
            description,
            modified: new Date().toISOString(),
            publisherWebId: session.webId!,
            fetch: solidFetch,
          });
        } catch (catalogErr) {
          await solidFetch(binaryUri, { method: "DELETE" }).catch(() => {});
          await solidFetch(indexResource.uri, { method: "DELETE" }).catch(() => {});
          await solidFetch(`${mainContainer.uri}${containerSlug}/`, { method: "DELETE" }).catch(() => {});
          throw new Error(`Catalog could not be updated. ${(catalogErr as Error).message}`, { cause: catalogErr });
        }

        if (!profileHasCatalog) {
          await linkCatalogToProfile(catalogUri, session.webId!, solidFetch).catch(() => {});
        }
      });

      // The catalog PATCH bypassed LDO, so the resource subscription
      // in useCatalog has no way of knowing the catalog changed. Push
      // a local notification so consumers re-fetch immediately.
      notifyCatalogChanged(catalogUri);
    } finally {
      setIsUploading(false);
    }
  }, [session, solidFetch, createData, commitData]);

  return { isUploading, upload };
}
