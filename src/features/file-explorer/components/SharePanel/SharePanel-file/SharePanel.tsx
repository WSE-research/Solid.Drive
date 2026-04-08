/**
 * Share panel for managing file access permissions.
 *
 * @packageDocumentation
 */

import { useEffect } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth, useSubject, useResource } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable } from "@/infrastructure/solid/resourceGuards";
import { useAclManager } from "@/features/sharing/hooks/useAclManager";
import { getInitial } from "@/shared/utils";

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
  const contactResource = useResource(webId.split("#")[0]);
  const contact = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(contactResource) && contactResource.isLoading();
  const webIdFallbackName =
    webId
      .replace(/#.*$/, "")
      .split("/")
      .filter(Boolean)
      .find((pathSegment) => pathSegment !== "profile" && pathSegment !== "card" && !pathSegment.startsWith("http")) ?? webId;
  const displayName = contact?.name ?? contact?.fn ?? webIdFallbackName;

  return (
    <div className="share-panel__row">
      <div className="share-panel__avatar share-panel__avatar--grantee">
        {isLoading ? <div className="spinner spinner--tiny" /> : getInitial(displayName)}
      </div>
      <div className="share-panel__name">
        <span className="share-panel__name-text">
          {isLoading ? translate("sharePanel.loading") : displayName}
        </span>
        <span className="share-panel__mode">
          {translate("sharePanel.accessMode")}
        </span>
      </div>
      <button
        className="btn btn--delete btn--small share-panel__revoke"
        onClick={onRevoke}
        disabled={disabled}
      >
        {translate("sharePanel.revoke")}
      </button>
    </div>
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
  const contactResource = useResource(webId.split("#")[0]);
  const contact = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(contactResource) && contactResource.isLoading();
  const webIdFallbackName =
    webId
      .replace(/#.*$/, "")
      .split("/")
      .filter(Boolean)
      .find((pathSegment) => pathSegment !== "profile" && pathSegment !== "card" && !pathSegment.startsWith("http")) ?? webId;
  const displayName = contact?.name ?? contact?.fn ?? webIdFallbackName;

  return (
    <div className="share-panel__row--available">
      <div className="share-panel__avatar share-panel__avatar--pending">
        {isLoading ? <div className="spinner spinner--tiny" /> : getInitial(displayName)}
      </div>
      <span className="share-panel__name-text--pending">
        {isLoading ? translate("sharePanel.loading") : displayName}
      </span>
      <button
        className="btn btn--ghost btn--small"
        onClick={onGrant}
        disabled={disabled}
      >
        {translate("sharePanel.grant")}
      </button>
    </div>
  );
};

/**
 * Props for the SharePanel component.
 */
type SharePanelProps = {
  containerUri: string;
  catalogUri: string;
  contacts: string[];
  sharedEntry: {
    metadataUri: string;
    binaryUri: string;
    classUri: string;
    mediaType: string;
    byteSize: number;
    title: string;
    description: string;
    modified: string;
  };
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

  if (!ownerWebId) return null;

  return (
    <div className="share-panel">
      <p className="share-panel__heading">{translate("sharePanel.access")}</p>

      {loading && (
        <div className="share-panel__loading">
          <div className="spinner spinner--xs" />
          {translate("sharePanel.loadingAccessList")}
        </div>
      )}

      {displayError && (
        <p className="share-panel__error">{displayError}</p>
      )}

      {!loading && !displayError && (
        <>
          {grantees.length === 0 ? (
            <p className="share-panel__placeholder">
              {translate("sharePanel.notShared")}
            </p>
          ) : (
            grantees.filter(Boolean).map((webId) => (
              <GranteeRow
                key={webId}
                webId={webId}
                onRevoke={() => revoke(webId)}
                disabled={isSaving}
              />
            ))
          )}

          {availableContacts.length > 0 && (
            <>
              <p className="share-panel__subheading">{translate("sharePanel.shareWith")}</p>
              {availableContacts.filter(Boolean).map((webId) => (
                <ContactPickerRow
                  key={webId}
                  webId={webId}
                  onGrant={() => grant(webId)}
                  disabled={isSaving}
                />
              ))}
            </>
          )}

          {contacts.filter((contactWebId) => contactWebId !== ownerWebId).length === 0 && (
            <p className="share-panel__placeholder">
              {translate("sharePanel.addContacts")}
            </p>
          )}
          {availableContacts.length === 0 && contacts.filter((contactWebId) => contactWebId !== ownerWebId).length > 0 && (
            <p className="share-panel__placeholder">
              {translate("sharePanel.allHaveAccess")}
            </p>
          )}
        </>
      )}
    </div>
  );
};
