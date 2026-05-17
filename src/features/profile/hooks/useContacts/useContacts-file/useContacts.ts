/**
 * @packageDocumentation
 * Manages the user's foaf:knows contact list.
 */

import { useState, useEffect } from "react";
import { useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isReloadable } from "@/infrastructure/solid/resourceGuards";
import { addContact as addProfileContact, removeContact as removeProfileContact } from "@/infrastructure/solid/profile";

interface UseContactsReturn {
  contacts: string[];
  addContact: (webId: string) => Promise<void>;
  removeContact: (webId: string) => Promise<void>;
  isAdding: boolean;
}

/**
 * Reads and modifies the foaf:knows triples in a user's profile.
 *
 * @param ownerWebId - WebID of the profile to manage
 *
 * @public
 */
export function useContacts(ownerWebId: string): UseContactsReturn {
  const { fetch: solidFetch } = useSolidAuth();
  // Subscribe so an added or removed foaf:knows from another tab or
  // device is picked up without a reload.
  const webIdResource = useResource(ownerWebId, { subscribe: true });
  const profile = useSubject(SolidProfileShapeType, ownerWebId);
  const [contacts, setContacts] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const knows = profile.knows?.toArray().map((entry: { "@id": string }) => entry["@id"]) ?? [];
    setContacts(knows);
  }, [profile]);

  const addContact = async (webId: string) => {
    const trimmed = webId.trim();
    if (contacts.includes(trimmed)) {
      throw new Error("This contact is already in your list.");
    }
    setIsAdding(true);
    try {
      await addProfileContact(ownerWebId, trimmed, solidFetch);
      setContacts((prev) => [...prev, trimmed]);
      if (isReloadable(webIdResource)) webIdResource.reload();
    } finally {
      setIsAdding(false);
    }
  };

  const removeContact = async (webId: string) => {
    await removeProfileContact(ownerWebId, webId, solidFetch);
    setContacts((prev) => prev.filter((contactWebId) => contactWebId !== webId));
    if (isReloadable(webIdResource)) webIdResource.reload();
  };

  return { contacts, addContact, removeContact, isAdding };
}
