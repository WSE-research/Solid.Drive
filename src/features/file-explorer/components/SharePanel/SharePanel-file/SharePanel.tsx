/**
 * Share panel for managing file access permissions.
 *
 * @packageDocumentation
 */

import { useEffect } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { useAclManager } from "@/features/sharing/hooks/useAclManager";
import { Avatar } from "@/shared/components/Avatar";
import { useContactProfile } from "@/shared/hooks/useContactProfile";
import type { SharedEntry } from "@/types";

/**
 * Row displaying a user who has been granted access.
 *
 * @internal
 */
const GranteeRow: FunctionComponent<{ webId: string; onRevoke: () => void; disabled: boolean }> = ({
  webId,
  onRevoke,
  disabled,
}) => {
  const [translate] = useTranslation();
  const { displayName, avatarUrl, initial, isLoading } = useContactProfile(webId);
  const nameContent = isLoading ? translate("sharePanel.loading") : displayName;

  return (
    <share-panel-row>
      <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
      <share-panel-name>
        <span className="share-panel__name-text">{nameContent}</span>
        <span className="share-panel__mode">{translate("sharePanel.accessMode")}</span>
      </share-panel-name>
      <button
        className="btn btn--delete btn--small share-panel__revoke"
        onClick={onRevoke}
        disabled={disabled}
      >
        {translate("sharePanel.revoke")}
      </button>
    </share-panel-row>
  );
};

/**
 * Row for selecting a contact to grant access to.
 *
 * @internal
 */
const ContactPickerRow: FunctionComponent<{ webId: string; onGrant: () => void; disabled: boolean }> = ({
  webId,
  onGrant,
  disabled,
}) => {
  const [translate] = useTranslation();
  const { 
    displayName, 
    avatarUrl, 
    initial, 
    isLoading 
  } = useContactProfile(webId);
  const nameContent = isLoading ? translate("sharePanel.loading") : displayName;

  return (
    <share-panel-row className="share-panel__row--available">
      <span className="share-panel__avatar--pending-wrap">
        <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
      </span>
      <span className="share-panel__name-text--pending">{nameContent}</span>
      <button
        className="btn btn--ghost btn--small"
        onClick={onGrant}
        disabled={disabled}
      >
        {translate("sharePanel.grant")}
      </button>
    </share-panel-row>
  );
};

/**
 * Props for the SharePanel component.
 */
type SharePanelProps = {
  containerUri: string;
  catalogUri: string;
  contacts: string[];
  sharedEntry: SharedEntry;
};

/**
 * Panel for granting and revoking file access to contacts.
 * Manages ACLs and per-contact shared catalog entries.
 *
 * @public
 */
export const SharePanel: FunctionComponent<SharePanelProps> = ({ containerUri, catalogUri, contacts, sharedEntry }) => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const ownerWebId = session.webId ?? "";
  const appContainerUri = containerUri.replace(/\/$/, "").split("/").slice(0, -1).join("/") + "/";

  const { grantees, loading, error, isSaving, loadAcl, grant, revoke } = useAclManager(
    containerUri,
    catalogUri,
    appContainerUri,
    ownerWebId,
    sharedEntry
  );

  useEffect(() => {
    loadAcl();
  }, [loadAcl]);

  const displayError = error?.includes("No ACL link header") ? translate("sharePanel.notSupported") : error;
  const availableContacts = contacts.filter(
    (contactWebId) => contactWebId !== ownerWebId && !grantees.includes(contactWebId)
  );
  const otherContacts = contacts.filter((contactWebId) => contactWebId !== ownerWebId);
  const hasNoOtherContacts = otherContacts.length === 0;
  const allContactsHaveAccess = availableContacts.length === 0 && !hasNoOtherContacts;
  const validGrantees = grantees.filter(Boolean);
  const validAvailableContacts = availableContacts.filter(Boolean);
  const hasAvailableContacts = validAvailableContacts.length > 0;
  const isReady = !loading && !displayError;
  const hasNoGrantees = validGrantees.length === 0;

  if (!ownerWebId) return null;

  return (
    <share-panel>
      <p className="share-panel__heading">{translate("sharePanel.access")}</p>

      {loading && (
        <share-panel-loading>
          <div className="spinner spinner--xs" />
          {translate("sharePanel.loadingAccessList")}
        </share-panel-loading>
      )}

      {displayError && (
        <p className="share-panel__error">{displayError}</p>
      )}

      {isReady && (
        <>
          {hasNoGrantees ? (
            <p className="share-panel__placeholder">
              {translate("sharePanel.notShared")}
            </p>
          ) : (
            validGrantees.map((webId) => (
              <GranteeRow
                key={webId}
                webId={webId}
                onRevoke={() => revoke(webId)}
                disabled={isSaving}
              />
            ))
          )}

          {hasAvailableContacts && (
            <>
              <p className="share-panel__subheading">{translate("sharePanel.shareWith")}</p>
              {validAvailableContacts.map((webId) => (
                <ContactPickerRow
                  key={webId}
                  webId={webId}
                  onGrant={() => grant(webId)}
                  disabled={isSaving}
                />
              ))}
            </>
          )}

          {hasNoOtherContacts && (
            <p className="share-panel__placeholder">
              {translate("sharePanel.addContacts")}
            </p>
          )}
          {allContactsHaveAccess && (
            <p className="share-panel__placeholder">
              {translate("sharePanel.allHaveAccess")}
            </p>
          )}
        </>
      )}
    </share-panel>
  );
};
