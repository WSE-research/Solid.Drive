import { useState, useEffect, useRef } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSubject, useSolidAuth } from "@ldo/solid-react";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isLoadable, isReloadable } from "./pod";
import { ensureProfileDocType, saveProfileFields, type ProfileFields } from "./foaf";



const ProfileInput: FunctionComponent<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, disabled, placeholder }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </label>
    <input
      type="text"
      className="file-upload__title"
      style={{ fontSize: 13, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  </div>
);

// ─── ProfileCard ─────────────────────────────────────────────────────────────

const ProfileCard: FunctionComponent = () => {
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
  const firstLetter = displayName.slice(0, 1).toUpperCase() || "?";

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
    <div style={{ marginBottom: 24 }}>
      {/* Avatar + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {editing ? (
          <label style={{ cursor: "pointer", position: "relative", flexShrink: 0, width: 48, height: 48, display: "block" }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={saving || uploadingAvatar}
              onChange={(event) => { const selectedFile = event.target.files?.[0]; if (selectedFile) handleAvatarUpload(selectedFile); }}
            />
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName || "avatar"} width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600 }}>
                {uploadingAvatar ? <div className="spinner" style={{ width: 18, height: 18 }} /> : firstLetter}
              </div>
            )}
            {!uploadingAvatar && (
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            )}
          </label>
        ) : avatarUrl ? (
          <img src={avatarUrl} alt={displayName || "avatar"} width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
            {isLoading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : firstLetter}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isLoading ? "Loading…" : (displayName || <span style={{ color: "var(--text-muted)" }}>Name not set</span>)}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.webId}
          </p>
        </div>
      </div>


      {/* Edit form */}
      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <ProfileInput label="Name" value={name} onChange={setName} disabled={saving} />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: "6px 14px", width: "100%" }}
          onClick={handleEditStart}
        >
          Edit profile
        </button>
      )}
    </div>
  );
};


const ContactRow: FunctionComponent<{ webId: string; onRemove: () => void }> = ({ webId, onRemove }) => {
  const contactResource = useResource(webId.split("#")[0]);
  const contact = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(contactResource) && contactResource.isLoading();

  const username = webId.replace(/#.*$/, "").split("/").filter(Boolean).find(segment => segment !== "profile" && segment !== "card" && !segment.startsWith("http")) ?? webId;
  const displayName = contact?.name ?? contact?.fn ?? username;
  const avatarUrl = contact?.img?.["@id"];
  const firstLetter = displayName.slice(0, 1).toUpperCase() || "?";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName} width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
          {isLoading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : firstLetter}
        </div>
      )}
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isLoading ? "Loading…" : (displayName.length > 30 ? displayName.slice(0, 30) + "…" : displayName)}
      </span>
      <button className="btn btn-danger" style={{ fontSize: 11, padding: "3px 8px" }} onClick={onRemove}>
        Remove
      </button>
    </div>
  );
};
 

const ContactsList: FunctionComponent = () => {
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
      const addResponse = await solidFetch(session.webId.split("#")[0], {
        method: "PATCH",
        headers: { "Content-Type": "text/n3" },
        body: `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
<> a solid:InsertDeletePatch;
  solid:inserts { <#me> foaf:knows <${trimmed}> . } .`,
      });
      if (!addResponse.ok) throw new Error(`${addResponse.status} ${addResponse.statusText}`);
      setContacts(prev => [...prev, trimmed]);
      setNewWebId("");
      if (isReloadable(webIdResource)) webIdResource.reload();
    } catch (error) {
      alert(`Failed to add contact: ${(error as Error).message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (contactWebId: string) => {
    if (!session.webId) return;
    try {
      const removeResponse = await solidFetch(session.webId.split("#")[0], {
        method: "PATCH",
        headers: { "Content-Type": "text/n3" },
        body: `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
<> a solid:InsertDeletePatch;
  solid:deletes { <#me> foaf:knows <${contactWebId}> . } .`,
      });
      if (!removeResponse.ok) throw new Error(`${removeResponse.status} ${removeResponse.statusText}`);
      setContacts(prev => prev.filter(existingContact => existingContact !== contactWebId));
      if (isReloadable(webIdResource)) webIdResource.reload();
    } catch (error) {
      alert(`Failed to remove contact: ${(error as Error).message}`);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        Contacts
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          type="text"
          className="file-upload__title"
          placeholder="WebID https://…"
          value={newWebId}
          onChange={(event) => setNewWebId(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") handleAdd(); }}
          disabled={isAdding}
          style={{ flex: 1, fontSize: 12, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
        />
        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: "6px 12px" }}
          onClick={handleAdd}
          disabled={isAdding || !newWebId.trim()}
        >
          {isAdding ? "…" : "Add"}
        </button>
      </div>

      {contacts.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>No contacts yet.</p>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
      <ProfileCard />
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
      <ContactsList />
    </div>
  </aside>
);
