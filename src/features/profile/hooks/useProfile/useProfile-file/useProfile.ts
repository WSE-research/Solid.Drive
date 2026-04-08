/**
 * @packageDocumentation
 * Manages the current user's Solid profile fields.
 */

import { useState, useEffect } from "react";
import { useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable, isReloadable } from "@/infrastructure/solid/resourceGuards";
import { saveProfileFields, ensureProfileDocType } from "@/infrastructure/solid/profile";
import type { ProfileFields } from "@/types";

interface UseProfileReturn {
  name: string;
  imgUrl: string;
  displayName: string;
  isLoading: boolean;
  setName: (value: string) => void;
  setImgUrl: (value: string) => void;
  save: (original: ProfileFields) => Promise<void>;
  reload: () => Promise<void>;
}

interface UseProfileOptions {
  suspendSync?: boolean;
}

/**
 * Provides read/write access to the logged-in user's profile.
 *
 * @public
 */
export function useProfile({ suspendSync = false }: UseProfileOptions = {}): UseProfileReturn {
  const { session, fetch: solidFetch } = useSolidAuth();
  const webIdResource = useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const [name, setName] = useState("");
  const [imgUrl, setImgUrl] = useState("");

  useEffect(() => {
    if (suspendSync) return;
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(profile.name ?? "");
    setImgUrl(profile.img?.["@id"] ?? "");
  }, [profile, suspendSync]);

  const isLoading = isLoadable(webIdResource) && webIdResource.isLoading();
  const displayName = profile?.name ?? profile?.fn ?? "";

  const save = async (original: ProfileFields) => {
    if (!session.webId) return;
    await saveProfileFields(session.webId, original, { name, imgUrl }, solidFetch);
    await ensureProfileDocType(session.webId, solidFetch).catch(() => {});
    if (isReloadable(webIdResource)) await webIdResource.reload();
  };

  const reload = async () => {
    if (isReloadable(webIdResource)) await webIdResource.reload();
  };

  return { name, imgUrl, displayName, isLoading, setName, setImgUrl, save, reload };
}
