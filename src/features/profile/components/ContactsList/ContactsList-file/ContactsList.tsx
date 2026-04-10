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
        const rejectionNotifications = await listRejectionNotifications(inboxUri, solidFetch);
        if (cancelled) return;
        // For catalog requests, accessTo is the contact's WebID
        const rejectionMap = new Map(rejectionNotifications.map((rejection) => [rejection.accessTo, rejection]));
        setRejections(rejectionMap);
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

  const handleWebIdChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setNewWebId(event.target.value);
  const handleWebIdKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleAdd();
  };
  const handleClearRejection = (contactWebId: string) => {
    setRejections((prev) => {
      const next = new Map(prev);
      next.delete(contactWebId);
      return next;
    });
  };

  return (
    <div>
      <p className="contacts__heading">
        {translate("profileSidebar.contacts")}
      </p>

      <contacts-input-row>
        <input
          type="text"
          className="contacts__input"
          placeholder={translate("profileSidebar.webIdPlaceholder")}
          value={newWebId}
          onChange={handleWebIdChange}
          onKeyDown={handleWebIdKeyDown}
          disabled={isAdding}
        />
        <button
          className="btn btn--primary btn--small"
          onClick={handleAdd}
          disabled={isAdding || !newWebId.trim()}
        >
          {isAdding ? "..." : translate("profileSidebar.add")}
        </button>
      </contacts-input-row>

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
            onClearRejection={() => handleClearRejection(contactWebId)}
            onRemove={() => handleRemove(contactWebId)}
          />
        ))
      )}
    </div>
  );
};
