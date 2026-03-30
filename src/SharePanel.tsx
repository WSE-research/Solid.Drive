import { useState, useEffect, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth, useSubject, useResource } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { discoverAclUri, readAclAgents, writeAcl } from "./fileAccess";
import { isLoadable } from "./pod";

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

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
      .find((s) => s !== "profile" && s !== "card" && !s.startsWith("http")) ?? webId;
  const displayName = contact?.name ?? contact?.fn ?? webIdFallbackName;

  return (
    <div className="share-panel__row">
      <div className="share-panel__avatar share-panel__avatar--grantee">
        {isLoading ? <div className="spinner spinner--tiny" /> : displayName.slice(0, 1).toUpperCase()}
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
      .find((s) => s !== "profile" && s !== "card" && !s.startsWith("http")) ?? webId;
  const displayName = contact?.name ?? contact?.fn ?? webIdFallbackName;

  return (
    <div className="share-panel__row--available">
      <div className="share-panel__avatar share-panel__avatar--pending">
        {isLoading ? <div className="spinner spinner--tiny" /> : displayName.slice(0, 1).toUpperCase()}
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


type SharePanelProps = {
  containerUri: string;
  contacts: string[];
};

export const SharePanel: FunctionComponent<SharePanelProps> = ({ containerUri, contacts }) => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const ownerWebId = session.webId ?? "";

  const [aclUri, setAclUri] = useState<string | null>(null);
  const [grantees, setGrantees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadAcl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const discoveredAclUri = await discoverAclUri(containerUri, solidFetch);
      setAclUri(discoveredAclUri);
      const currentGrantees = await readAclAgents(discoveredAclUri, solidFetch);
      setGrantees(currentGrantees);
    } catch (err) {
      const message = toMessage(err);
      if (message.includes("No ACL link header")) {
        setError(translate("sharePanel.notSupported"));
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [containerUri, solidFetch, translate]);

  useEffect(() => {
    loadAcl();
  }, [loadAcl]);

  const handleGrant = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = [...grantees, contactWebId];
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      setGrantees(newGrantees);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, containerUri, grantees, ownerWebId, solidFetch]);

  const handleRevoke = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = grantees.filter((granteeWebId) => granteeWebId !== contactWebId);
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      setGrantees(newGrantees);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, containerUri, grantees, ownerWebId, solidFetch]);

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

      {error && (
        <p className="share-panel__error">{error}</p>
      )}

      {!loading && !error && (
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
                onRevoke={() => handleRevoke(webId)}
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
                  onGrant={() => handleGrant(webId)}
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
