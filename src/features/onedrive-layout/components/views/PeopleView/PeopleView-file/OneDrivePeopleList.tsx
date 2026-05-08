/**
 * OneDrive-styled contacts list for the People view.
 *
 * Reuses the same {@link useContacts} hook the classic profile sidebar
 * relies on, but renders a clean dark-mode list to match the rest of
 * the OneDrive shell:
 *   - Header: "People" title + a person/name filter input
 *   - Body: one clickable row per contact (avatar + display name); a
 *     hover-revealed × icon removes the contact
 *   - Footer: collapsible "Add contact" form with WebID input
 *
 * Clicking a row calls `onSelect` so the parent can navigate into the
 * per-contact detail view.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, FunctionComponent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSolidAuth } from '@ldo/solid-react';
import { Avatar } from '@/shared/components/Avatar';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { useContactProfile } from '@/shared/hooks/useContactProfile';
import { useContacts } from '@/features/profile/hooks/useContacts';
import {
  discoverInboxUri,
  postCatalogAccessRequest,
} from '@/infrastructure/inbox/inboxAccess';
import {
  PlusIcon,
  CloseIcon,
  DeleteIcon,
  RequestAccessIcon,
  CheckmarkIcon,
} from '@/features/onedrive-layout/icons';

/** Accepts any http/https URL with no whitespace or reserved URI characters. */
const WEBID_URL_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`[\]]*$/;

/**
 * Props for {@link OneDrivePeopleList}.
 *
 * @public
 */
export interface OneDrivePeopleListProps {
  /** Current user's WebID — drives the foaf:knows fetch. */
  ownerWebId: string;
  /** Fires when the user clicks a contact row. */
  onSelect: (contactWebId: string) => void;
}

type RequestStatus = 'idle' | 'sending' | 'sent' | 'error';

interface PersonRowProps {
  webId: string;
  ownerWebId: string;
  query: string;
  onSelect: (webId: string) => void;
  onRemove: (webId: string) => void;
}

/**
 * Single contact row — clickable surface for the whole avatar+name
 * area, with two trailing icon buttons: a Request Access (key) icon
 * that posts a catalog-level access request to the contact's inbox,
 * and a Remove (×) icon that drops the contact from the user's
 * `foaf:knows` list. Both stop propagation so the row's select
 * handler never fires from an action click.
 *
 * @internal
 */
const PersonRow: FunctionComponent<PersonRowProps> = ({
  webId,
  ownerWebId,
  query,
  onSelect,
  onRemove,
}) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const { displayName, avatarUrl, initial, isLoading } = useContactProfile(webId);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('idle');

  const trimmedQuery = query.trim().toLowerCase();
  const matchesQuery =
    trimmedQuery.length === 0 ||
    displayName.toLowerCase().includes(trimmedQuery) ||
    webId.toLowerCase().includes(trimmedQuery);

  const handleRequestAccess = useCallback(async () => {
    setRequestStatus('sending');
    try {
      const inboxUri = await discoverInboxUri(webId, solidFetch);
      await postCatalogAccessRequest(inboxUri, ownerWebId, webId, solidFetch);
      setRequestStatus('sent');
    } catch {
      setRequestStatus('error');
    }
  }, [webId, ownerWebId, solidFetch]);

  if (!matchesQuery) return null;

  const handleClick = () => onSelect(webId);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(webId);
    }
  };
  const handleRemoveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRemove(webId);
  };
  const handleRequestClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void handleRequestAccess();
  };

  const requestLabel =
    requestStatus === 'sending'
      ? translate('profileSidebar.loading', 'Loading…')
      : requestStatus === 'sent'
      ? translate('profileSidebar.requestSent', 'Requested')
      : requestStatus === 'error'
      ? translate('profileSidebar.requestError', 'Retry')
      : translate('profileSidebar.requestAccess', 'Request Access');

  const RequestStatusIcon =
    requestStatus === 'sent' ? CheckmarkIcon : RequestAccessIcon;
  const isRequestDisabled = requestStatus === 'sending' || requestStatus === 'sent';

  return (
    <person-row
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="person-row"
      data-webid={webId}
    >
      <Avatar size="md" src={avatarUrl} alt={displayName} initial={initial} isLoading={isLoading} />
      <span className="odl-people-row__name" title={webId}>
        {displayName}
      </span>
      <button
        type="button"
        className={`odl-people-row__action odl-people-row__action--request odl-people-row__action--${requestStatus}`}
        aria-label={requestLabel}
        title={requestLabel}
        onClick={handleRequestClick}
        disabled={isRequestDisabled}
      >
        <RequestStatusIcon aria-hidden focusable={false} />
      </button>
      <button
        type="button"
        className="odl-people-row__action odl-people-row__action--remove"
        aria-label={translate('profileSidebar.remove', 'Remove')}
        title={translate('profileSidebar.remove', 'Remove')}
        onClick={handleRemoveClick}
      >
        <DeleteIcon aria-hidden focusable={false} />
      </button>
    </person-row>
  );
};

/**
 * OneDrive-styled people list.
 *
 * @public
 */
export const OneDrivePeopleList: FunctionComponent<OneDrivePeopleListProps> = ({
  ownerWebId,
  onSelect,
}) => {
  const [translate] = useTranslation();
  const { contacts, addContact, removeContact, isAdding } = useContacts(ownerWebId);
  const { showError, confirm } = useNotifications();

  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newWebId, setNewWebId] = useState('');

  // Keep the contacts list reference stable across renders so a single
  // contact's row re-rendering doesn't reorder its siblings.
  const contactList = useMemo(() => [...contacts], [contacts]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) =>
    setQuery(event.target.value);
  const handleNewWebIdChange = (event: ChangeEvent<HTMLInputElement>) =>
    setNewWebId(event.target.value);

  const handleAddSubmit = async () => {
    const trimmed = newWebId.trim();
    if (!WEBID_URL_PATTERN.test(trimmed)) {
      showError(translate('profileSidebar.invalidWebId', 'WebID must be a valid http(s):// URL'));
      return;
    }
    try {
      await addContact(trimmed);
      setNewWebId('');
      setAddOpen(false);
    } catch (err) {
      showError((err as Error).message);
    }
  };

  const handleAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void handleAddSubmit();
    if (event.key === 'Escape') {
      setAddOpen(false);
      setNewWebId('');
    }
  };

  const handleRemove = async (webId: string) => {
    const ok = await confirm(
      translate('profileSidebar.remove', 'Remove'),
    );
    if (!ok) return;
    try {
      await removeContact(webId);
    } catch (err) {
      showError((err as Error).message);
    }
  };

  const isAddDisabled = isAdding || !newWebId.trim();
  const hasNoContacts = contactList.length === 0;

  return (
    <people-list>
      {/*
        OneDriveLayout suppresses its page-header for the People view,
        so this row owns the title + filter + add controls — they sit
        on a single line, separated from the contact rows by a bottom
        border.
      */}
      <people-list-header>
        <h1 className="odl-people-list__heading">
          {translate('oneDriveLayout.peopleView.heading', 'People')}
        </h1>
        <input
          type="search"
          className="odl-people-list__filter"
          placeholder={translate(
            'oneDriveLayout.filters.personPlaceholder',
            'Filter by name or person',
          )}
          aria-label={translate(
            'oneDriveLayout.filters.personPlaceholder',
            'Filter by name or person',
          )}
          value={query}
          onChange={handleQueryChange}
        />
        <button
          type="button"
          className="odl-people-list__add-toggle"
          aria-label={translate('profileSidebar.add', 'Add')}
          onClick={() => setAddOpen((open) => !open)}
        >
          {addOpen ? (
            <CloseIcon aria-hidden focusable={false} />
          ) : (
            <PlusIcon aria-hidden focusable={false} />
          )}
        </button>
      </people-list-header>

      {addOpen && (
        <people-list-add>
          <input
            type="text"
            className="odl-people-list__add-input"
            placeholder={translate(
              'profileSidebar.webIdPlaceholder',
              'WebID https://…',
            )}
            value={newWebId}
            onChange={handleNewWebIdChange}
            onKeyDown={handleAddKeyDown}
            disabled={isAdding}
            autoFocus
          />
          <button
            type="button"
            className="odl-people-list__add-submit"
            onClick={handleAddSubmit}
            disabled={isAddDisabled}
          >
            {isAdding
              ? '…'
              : translate('profileSidebar.add', 'Add')}
          </button>
        </people-list-add>
      )}

      {hasNoContacts ? (
        <p className="odl-people-list__empty">
          {translate('profileSidebar.noContacts', 'No contacts yet.')}
        </p>
      ) : (
        <people-list-body>
          {contactList.map((webId) => (
            <PersonRow
              key={webId}
              webId={webId}
              ownerWebId={ownerWebId}
              query={query}
              onSelect={onSelect}
              onRemove={handleRemove}
            />
          ))}
        </people-list-body>
      )}
    </people-list>
  );
};
