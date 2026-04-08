/**
 * Contacts list component for managing user contacts.
 *
 * @packageDocumentation
 */

import { useState, useEffect } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { useContacts } from "@/features/profile/hooks/useContacts";
import { discoverInboxUri, listRejectionNotifications } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { ContactRow } from "@/features/profile/components/ContactRow";
import { useNotifications } from "@/shared/contexts/NotificationContext";

/**
 * Props for the ContactsList component.
 */
type ContactsListProps = {
  ownerWebId: string;
};

/**
 * List of contacts with add/remove functionality.
 * Fetches rejection notifications from the user's inbox.
 *
 * @public
 */
export const ContactsList: FunctionComponent<ContactsListProps> = ({ ownerWebId }) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const { contacts, addContact, removeContact, isAdding } = useContacts(ownerWebId);
  const { showError } = useNotifications();
  
  const [newWebId, setNewWebId] = useState("");
  const [rejections, setRejections] = useState<Map<string, AccessRejection>>(new Map());

  useEffect(() => {
    if (!ownerWebId) return;
    let cancelled = false;
    void (async () => {
      try {
        const inboxUri = await discoverInboxUri(ownerWebId, solidFetch);
        const found = await listRejectionNotifications(inboxUri, solidFetch);
        if (cancelled) return;
        // For catalog requests, accessTo is the contact's WebID
        const map = new Map(found.map((r) => [r.accessTo, r]));
        setRejections(map);
      } catch {
        // Ignore missing or inaccessible inboxes
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerWebId, solidFetch]);

  const handleAdd = async () => {
    const trimmed = newWebId.trim();
    if (!/^https?:\/\/[^\s<>"{}|\\^`[\]]*$/.test(trimmed)) {
      showError("WebID must be a valid http(s):// URL without special characters");
      return;
    }
    try {
      await addContact(trimmed);
      setNewWebId("");
    } catch (err) {
      showError((err as Error).message);
    }
  };

  const handleRemove = async (contactWebId: string) => {
    try {
      await removeContact(contactWebId);
    } catch (err) {
      showError((err as Error).message);
    }
  };

  return (
    <div>
      <p className="contacts__heading">
        {translate("profileSidebar.contacts")}
      </p>

      <div className="contacts__input-row">
        <input
          type="text"
          className="contacts__input"
          placeholder={translate("profileSidebar.webIdPlaceholder")}
          value={newWebId}
          onChange={(event) => setNewWebId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
          disabled={isAdding}
        />
        <button
          className="btn btn--primary btn--small"
          onClick={handleAdd}
          disabled={isAdding || !newWebId.trim()}
        >
          {isAdding ? "..." : translate("profileSidebar.add")}
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="contacts__placeholder">{translate("profileSidebar.noContacts")}</p>
      ) : (
        contacts.map((contactWebId) => (
          <ContactRow
            key={contactWebId}
            webId={contactWebId}
            ownerWebId={ownerWebId}
            solidFetch={solidFetch}
            rejection={rejections.get(contactWebId)}
            onClearRejection={() => setRejections((prev) => {
              const next = new Map(prev);
              next.delete(contactWebId);
              return next;
            })}
            onRemove={() => handleRemove(contactWebId)}
          />
        ))
      )}
    </div>
  );
};
