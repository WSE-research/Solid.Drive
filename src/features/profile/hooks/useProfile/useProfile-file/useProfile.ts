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
  isUploadingAvatar: boolean;
  setName: (value: string) => void;
  setImgUrl: (value: string) => void;
  save: (original: ProfileFields) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  const uploadAvatar = async (file: File) => {
    if (!session.webId) return;
    const storageRoot =
      profile?.storage?.toArray()[0]?.["@id"] ??
      session.webId.replace(/\/profile\/card.*/, "/");
    const ext = file.name.split(".").pop() ?? "jpg";
    const avatarUri = `${storageRoot}public/avatar.${ext}`;
    setIsUploadingAvatar(true);
    try {
      const res = await solidFetch(avatarUri, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setImgUrl(avatarUri);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const reload = async () => {
    if (isReloadable(webIdResource)) await webIdResource.reload();
  };

  return { name, imgUrl, displayName, isLoading, isUploadingAvatar, setName, setImgUrl, save, uploadAvatar, reload };
}
