/**
 * Contacts list component for managing user contacts.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { FunctionComponent, KeyboardEvent, MouseEvent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { useContacts } from "@/features/profile/hooks/useContacts";
import { useContactRejections } from "@/shared/hooks/useContactRejections";
import { ContactRow } from "@/features/profile/components/ContactRow";
import { useNotifications } from "@/shared/contexts/NotificationContext";

/** Accepts any http/https URL that contains no whitespace or reserved URI characters. */
const WEBID_URL_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`[\]]*$/;

/**
 * Props for the ContactsList component.
 */
type ContactsListProps = {
  ownerWebId: string;
  /**
   * Optional. When provided, each contact row becomes selectable and
   * fires this callback. Used by the OneDrive PeopleView to drive its
   * "Files shared by this person" sub-panel. Defaults to no-op so the
   * classic profile sidebar is unaffected.
   */
  onSelect?: (contactWebId: string) => void;
  /** WebID of the currently active contact (for highlighting). */
  selectedWebId?: string;
};

/**
 * List of contacts with add/remove functionality.
 * Fetches rejection notifications from the user's inbox.
 *
 * @public
 */
export const ContactsList: FunctionComponent<ContactsListProps> = ({
  ownerWebId,
  onSelect,
  selectedWebId,
}) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const { contacts, addContact, removeContact, isAdding } = useContacts(ownerWebId);
  const { showError } = useNotifications();
  
  const [newWebId, setNewWebId] = useState("");
  const { fileRejections, handleClearRejection } = useContactRejections(ownerWebId);

  const handleAdd = async () => {
    const trimmed = newWebId.trim();
    if (!WEBID_URL_PATTERN.test(trimmed)) {
      showError(translate("profileSidebar.invalidWebId"));
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

  // When onSelect is provided, wrap each row in an interactive shell so
  // the surrounding area is clickable. Inner buttons (Request access,
  // Remove) keep their own click semantics — we ignore wrapper clicks
  // that originate inside an interactive descendant.
  const handleRowActivate = (contactWebId: string) => (event: MouseEvent | KeyboardEvent) => {
    if (!onSelect) return;
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    onSelect(contactWebId);
  };

  const renderRow = (contactWebId: string) => {
    const row = (
      <ContactRow
        key={contactWebId}
        webId={contactWebId}
        ownerWebId={ownerWebId}
        solidFetch={solidFetch}
        rejection={fileRejections.get(contactWebId)}
        onClearRejection={() => handleClearRejection(contactWebId)}
        onRemove={() => handleRemove(contactWebId)}
      />
    );
    if (!onSelect) return row;
    const isSelected = selectedWebId === contactWebId;
    return (
      <div
        key={contactWebId}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        data-selected={isSelected ? "true" : undefined}
        className={`contacts__selectable-row${isSelected ? " contacts__selectable-row--active" : ""}`}
        onClick={handleRowActivate(contactWebId)}
        onKeyDown={handleRowActivate(contactWebId)}
      >
        {row}
      </div>
    );
  };

  const contactRows = contacts.map(renderRow);

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
