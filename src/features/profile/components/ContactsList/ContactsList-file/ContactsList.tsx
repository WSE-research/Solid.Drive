/**
 * Contacts list component for managing user contacts.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { useContacts } from "@/features/profile/hooks/useContacts";
import { useContactRejections } from "@/shared/hooks/useContactRejections";
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
  const { fileRejections, handleClearRejection } = useContactRejections(ownerWebId);

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

  const isAddDisabled = isAdding || !newWebId.trim();
  const addButtonLabel = isAdding ? "..." : translate("profileSidebar.add");
  const hasNoContacts = contacts.length === 0;
  const contactRows = contacts.map((contactWebId) => (
    <ContactRow
      key={contactWebId}
      webId={contactWebId}
      ownerWebId={ownerWebId}
      solidFetch={solidFetch}
      rejection={fileRejections.get(contactWebId)}
      onClearRejection={() => handleClearRejection(contactWebId)}
      onRemove={() => handleRemove(contactWebId)}
    />
  ));

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
          disabled={isAddDisabled}
        >
          {addButtonLabel}
        </button>
      </contacts-input-row>

      {hasNoContacts ? (
        <p className="contacts__placeholder">{translate("profileSidebar.noContacts")}</p>
      ) : (
        contactRows
      )}
    </div>
  );
};
