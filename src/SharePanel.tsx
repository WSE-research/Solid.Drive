import { useState, useEffect, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useSolidAuth, useSubject, useResource } from "@ldo/solid-react";
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
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isLoading ? <div className="spinner" style={{ width: 10, height: 10 }} /> : displayName.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isLoading ? "Loading…" : displayName}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Access mode: Read
        </span>
      </div>
      <button
        className="btn btn-danger"
        style={{ fontSize: 11, padding: "2px 8px", flexShrink: 0 }}
        onClick={onRevoke}
        disabled={disabled}
      >
        Revoke
      </button>
    </div>
  );
};


const ContactPickerRow: FunctionComponent<{ webId: string; onGrant: () => void; disabled: boolean }> = ({
  webId,
  onGrant,
  disabled,
}) => {
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          flexShrink: 0,
          opacity: 0.6,
        }}
      >
        {isLoading ? <div className="spinner" style={{ width: 10, height: 10 }} /> : displayName.slice(0, 1).toUpperCase()}
      </div>
      <span style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isLoading ? "Loading…" : displayName}
      </span>
      <button
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: "2px 8px" }}
        onClick={onGrant}
        disabled={disabled}
      >
        Grant
      </button>
    </div>
  );
};


type SharePanelProps = {
  containerUri: string;
  contacts: string[];
};

export const SharePanel: FunctionComponent<SharePanelProps> = ({ containerUri, contacts }) => {
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
        setError("Sharing is not supported by your pod provider.");
      } else {
        setError(`Failed to load access list: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [containerUri, solidFetch]);

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
      setError(`Failed to grant access: ${toMessage(err)}`);
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
      setError(`Failed to revoke access: ${toMessage(err)}`);
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
      <p className="share-panel__heading">Access</p>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>
          <div className="spinner" style={{ width: 12, height: 12 }} />
          Loading access list…
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)", margin: "6px 0" }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          {grantees.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>
              Not shared with anyone yet.
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
              <p className="share-panel__subheading">Share with</p>
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
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>
              Add contacts in the sidebar to share files.
            </p>
          )}
          {availableContacts.length === 0 && contacts.filter((contactWebId) => contactWebId !== ownerWebId).length > 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>
              All contacts already have access.
            </p>
          )}
        </>
      )}
    </div>
  );
};
