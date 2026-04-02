import { useState, useEffect, useRef } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isLoadable, isReloadable } from "./pod";
import { ensureProfileDocType, saveProfileFields, addContact, removeContact, type ProfileFields } from "./foaf";

const ProfileInput: FunctionComponent<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, disabled, placeholder }) => (
  <div className="profile-input">
    <label className="profile-input__label">{label}</label>
    <input
      type="text"
      className="profile-input__field"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  </div>
);

// ─── ProfileCard ─────────────────────────────────────────────────────────────

const ProfileCard: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const webIdResource = useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const originalRef = useRef<ProfileFields>({ name: "", imgUrl: "" });

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setImgUrl(profile.img?.["@id"] ?? "");
  }, [profile]);

  const isLoading = isLoadable(webIdResource) && webIdResource.isLoading();
  const avatarUrl = editing ? (imgUrl || profile?.img?.["@id"]) : profile?.img?.["@id"];
  const displayName = editing ? name : (profile?.name ?? profile?.fn ?? "");
  const initial = displayName.slice(0, 1).toUpperCase() || "?";

  const handleAvatarUpload = async (file: File) => {
    if (!session.webId) return;
    const storageRoot =
      profile?.storage?.toArray()[0]?.["@id"] ??
      session.webId.replace(/\/profile\/card.*/, "/");
    const ext = file.name.split(".").pop() ?? "jpg";
    const avatarUri = `${storageRoot}public/avatar.${ext}`;
    setUploadingAvatar(true);
    try {
      const res = await solidFetch(avatarUri, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setImgUrl(avatarUri);
    } catch (error) {
      alert(`Avatar upload failed: ${(error as Error).message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleEditStart = () => {
    originalRef.current = { name, imgUrl };
    setEditing(true);
  };

  const handleSave = async () => {
    if (!session.webId) return;
    setSaving(true);
    try {
      await saveProfileFields(session.webId, originalRef.current, { name, imgUrl }, solidFetch);
      await ensureProfileDocType(session.webId, solidFetch).catch(() => {});
      if (isReloadable(webIdResource)) await webIdResource.reload();
      setEditing(false);
    } catch (error) {
      alert(`Save failed: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-card">
      {/* Avatar + name row */}
      <div className="profile-card__header">
        {editing ? (
          <label className="avatar avatar--upload">
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={saving || uploadingAvatar}
              onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) handleAvatarUpload(selectedFile); }}
            />
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName || "avatar"} className="avatar" />
            ) : (
              <div className="avatar avatar--placeholder">
                {uploadingAvatar ? <div className="spinner" /> : initial}
              </div>
            )}
            {!uploadingAvatar && (
              <div className="avatar--overlay">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            )}
          </label>
        ) : avatarUrl ? (
          <img src={avatarUrl} alt={displayName || "avatar"} className="avatar" />
        ) : (
          <div className="avatar avatar--placeholder">
          {isLoading ? <div className="spinner" /> : initial}
          </div>
        )}
        <div className="profile-card__info">
          <p className="profile-card__name">
            {isLoading ? translate("profileSidebar.loading") : (displayName || <span className="profile-card__muted">{translate("profileSidebar.nameNotSet")}</span>)}
          </p>
          <p className="profile-card__webid">
            {session.webId}
          </p>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="profile-card__edit">
          <ProfileInput label={translate("profileSidebar.name")} value={name} onChange={setName} disabled={saving} />
          <div className="profile-card__actions">
            <button
              className="btn btn--primary btn--small"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? translate("profileSidebar.saving") : translate("profileSidebar.save")}
            </button>
            <button
              className="btn btn--ghost btn--small"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              {translate("profileSidebar.cancel")}
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <button
          className="btn btn--ghost btn--small profile-card__edit-btn"
          onClick={handleEditStart}
        >
          {translate("profileSidebar.editProfile")}
        </button>
      )}
    </div>
  );
};


const ContactRow: FunctionComponent<{ webId: string; onRemove: () => void }> = ({ webId, onRemove }) => {
  const [translate] = useTranslation();
  const contactResource = useResource(webId.split("#")[0]);
  const contact = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(contactResource) && contactResource.isLoading();

  const extractedUsername = webId.replace(/#.*$/, "").split("/").filter(Boolean).find(segment => segment !== "profile" && segment !== "card" && !segment.startsWith("http")) ?? webId;
  const displayName = contact?.name ?? contact?.fn ?? extractedUsername;
  const avatarUrl = contact?.img?.["@id"];
  const initial = displayName.slice(0, 1).toUpperCase() || "?";

  return (
    <div className="contact-row">
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName} className="avatar avatar--sm" />
      ) : (
        <div className="avatar avatar--sm avatar--placeholder">
          {isLoading ? <div className="spinner" /> : initial}
        </div>
      )}
      <span className="contact-row__name">
        {isLoading ? translate("profileSidebar.loading") : (displayName.length > 30 ? displayName.slice(0, 30) + "…" : displayName)}
      </span>
      <button className="btn btn--delete btn--small" onClick={onRemove}>
        {translate("profileSidebar.remove")}
      </button>
    </div>
  );
};


const ContactsList: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session, fetch: solidFetch } = useSolidAuth();
  const webIdResource = useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const [contacts, setContacts] = useState<string[]>([]);
  const [newWebId, setNewWebId] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const knows = profile.knows?.toArray().map((contactEntry: { "@id": string }) => contactEntry["@id"]) ?? [];
    setContacts(knows);
  }, [profile]);

  const handleAdd = async () => {
    const trimmed = newWebId.trim();
    if (!/^https?:\/\/[^\s<>"{}|\\^`[\]]*$/.test(trimmed)) {
      alert("WebID must be a valid http(s):// URL without special characters");
      return;
    }
    if (!session.webId) return;
    if (contacts.includes(trimmed)) {
      alert("This contact is already in your list.");
      return;
    }
    setIsAdding(true);
    try {
      await addContact(session.webId, trimmed, solidFetch);
      setContacts(prev => [...prev, trimmed]);
      setNewWebId("");
      if (isReloadable(webIdResource)) await webIdResource.reload().catch(() => {});
    } catch (error) {
      alert(`Failed to add contact: ${(error as Error).message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (contactWebId: string) => {
    if (!session.webId) return;
    try {
      await removeContact(session.webId, contactWebId, solidFetch);
      setContacts(prev => prev.filter(existingContact => existingContact !== contactWebId));
      if (isReloadable(webIdResource)) await webIdResource.reload().catch(() => {});
    } catch (error) {
      alert(`Failed to remove contact: ${(error as Error).message}`);
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
          onKeyDown={(event) => { if (event.key === "Enter") handleAdd(); }}
          disabled={isAdding}
        />
        <button
          className="btn btn--primary btn--small"
          onClick={handleAdd}
          disabled={isAdding || !newWebId.trim()}
        >
          {isAdding ? "…" : translate("profileSidebar.add")}
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="contacts__placeholder">{translate("profileSidebar.noContacts")}</p>
      ) : (
        contacts.map((contactWebId) => (
          <ContactRow key={contactWebId} webId={contactWebId} onRemove={() => handleRemove(contactWebId)} />
        ))
      )}
    </div>
  );
};

// profile sidebar component
export const ProfileSidebar: FunctionComponent = () => (
  <aside className="profile-sidebar">
    <div className="profile-sidebar__card">
      <ProfileCard />
      <hr className="profile-sidebar__divider" />
      <ContactsList />
    </div>
  </aside>
);
