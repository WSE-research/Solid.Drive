/**
 * OneDrive-styled contacts list for the People view.
 *
 * Reuses the same {@link useContacts} hook the classic profile sidebar
 * relies on, but renders a clean list to match the rest of the OneDrive
 * shell:
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

import { useMemo, useState } from 'react';
import type { ChangeEvent, FunctionComponent, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSolidAuth } from '@ldo/solid-react';
import { Avatar } from '@/shared/components/Avatar';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { useContactProfile } from '@/shared/hooks/useContactProfile';
import { useContactRejections } from '@/shared/hooks/useContactRejections';
import { useRequestStatus } from '@/shared/hooks/usePendingRequests';
import { useContacts } from '@/features/profile/hooks/useContacts';
import { useContactRequest } from '@/features/profile/hooks/useContactRequest';
import type { AccessApproval, AccessRejection } from '@/infrastructure/inbox/inboxAccess';
import {
  PlusIcon,
  CloseIcon,
  DeleteIcon,
  RequestAccessIcon,
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

interface PersonRowProps {
  webId: string;
  ownerWebId: string;
  query: string;
  approval: AccessApproval | undefined;
  rejection: AccessRejection | undefined;
  onClearOutcome: () => void;
  onSelect: (webId: string) => void;
  onRemove: (webId: string) => void;
}

/**
 * Single contact row: a clickable surface over the avatar and name area,
 * trailed by the catalog request control and a Remove (×) icon. Once a
 * request is sent the control reads as its outcome: a Pending… pill while
 * awaiting, or an Approved/Denied pill with the key icon back beside it
 * so the request can be re-sent. Action clicks stop propagation so the
 * row's select handler never fires from them.
 *
 * @internal
 */
const PersonRow: FunctionComponent<PersonRowProps> = ({
  webId,
  ownerWebId,
  query,
  approval,
  rejection,
  onClearOutcome,
  onSelect,
  onRemove,
}) => {
  const [translate] = useTranslation();
  const { fetch: solidFetch } = useSolidAuth();
  const { displayName, avatarUrl, initial, isLoading } = useContactProfile(webId);
  const { failed, request, requestAgain } = useContactRequest({
    webId,
    ownerWebId,
    solidFetch,
    outcomeMessageUri: approval?.messageUri ?? rejection?.messageUri,
    onClearOutcome,
  });
  const status = useRequestStatus(webId, { approved: !!approval, denied: !!rejection });

  const trimmedQuery = query.trim().toLowerCase();
  const matchesQuery =
    trimmedQuery.length === 0 ||
    displayName.toLowerCase().includes(trimmedQuery) ||
    webId.toLowerCase().includes(trimmedQuery);

  if (!matchesQuery) return null;

  const handleClick = () => onSelect(webId);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(webId);
    }
  };
  const stop = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    handler();
  };

  const requestKey = (label: string, onClick: () => void): ReactNode => (
    <button
      type="button"
      className="odl-people-row__action odl-people-row__action--request"
      aria-label={label}
      title={label}
      onClick={stop(onClick)}
    >
      <RequestAccessIcon aria-hidden focusable={false} />
    </button>
  );

  const settledRequest = (modifier: 'approved' | 'denied', label: string): ReactNode => (
    <people-row-request>
      <span className={`request-status request-status--${modifier}`}>{label}</span>
      {requestKey(translate('profileSidebar.requestAgain', 'Request Again'), () => void requestAgain())}
    </people-row-request>
  );

  const requestControl = ((): ReactNode => {
    if (status === 'approved') {
      return settledRequest('approved', translate('profileSidebar.requestApproved', 'Approved'));
    }
    if (status === 'denied') {
      return settledRequest('denied', translate('profileSidebar.requestDenied', 'Denied'));
    }
    if (status === 'pending') {
      return <span className="request-status request-status--pending">{translate('profileSidebar.requestPending', 'Pending…')}</span>;
    }
    const label = failed
      ? translate('profileSidebar.requestError', 'Retry')
      : translate('profileSidebar.requestAccess', 'Request Access');
    return requestKey(label, () => void request());
  })();

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
      {requestControl}
      <button
        type="button"
        className="odl-people-row__action odl-people-row__action--remove"
        aria-label={translate('profileSidebar.remove', 'Remove')}
        title={translate('profileSidebar.remove', 'Remove')}
        onClick={stop(() => onRemove(webId))}
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
  const { fileRejections, fileApprovals, handleClearRejection } = useContactRejections(ownerWebId);
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
        so this row owns the title + filter + add controls; they sit
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
              approval={fileApprovals.get(webId)}
              rejection={fileRejections.get(webId)}
              onClearOutcome={() => handleClearRejection(webId)}
              onSelect={onSelect}
              onRemove={handleRemove}
            />
          ))}
        </people-list-body>
      )}
    </people-list>
  );
};
