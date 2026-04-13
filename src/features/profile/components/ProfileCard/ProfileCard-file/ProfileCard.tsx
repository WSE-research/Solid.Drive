/**
 * Profile card component for editing user profile.
 *
 * @packageDocumentation
 */

import { useState, useRef } from "react";
import type { FunctionComponent } from "react";
import { useSubject, useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { useNotifications } from "@/shared/contexts/NotificationContext";
import { getInitial } from "@/shared/utils";
import { Avatar } from "@/shared/components/Avatar";

/**
 * Props for the ProfileInput component.
 */
type ProfileInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Reusable input field for profile editing.
 *
 * @internal
 */
const ProfileInput: FunctionComponent<ProfileInputProps> = ({ 
  label, 
  value, 
  onChange, 
  disabled, 
  placeholder 
}) => (
  <profile-field>
    <label className="profile-input__label">{label}</label>
    <input
      type="text"
      className="profile-input__field"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  </profile-field>
);

/**
 * Profile card for viewing and editing user profile information.
 * Allows name and avatar updates with inline editing.
 *
 * @public
 */
export const ProfileCard: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const { showError, showSuccess } = useNotifications();
  const [editing, setEditing] = useState(false);
  
  const {
    name,
    imgUrl,
    displayName,
    isLoading,
    isUploadingAvatar,
    setName,
    setImgUrl,
    save,
    uploadAvatar,
  } = useProfile({ suspendSync: editing });

  const [saving, setSaving] = useState(false);
  const originalRef = useRef({ name: "", imgUrl: "" });

  const avatarUrl = editing ? (imgUrl || profile?.img?.["@id"]) : profile?.img?.["@id"];
  const currentDisplayName = editing ? name : displayName;
  const initial = getInitial(currentDisplayName);
  const nameDisplay = isLoading
    ? translate("profileSidebar.loading")
    : currentDisplayName || <span className="profile-card__muted">{translate("profileSidebar.nameNotSet")}</span>;

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    try {
      await uploadAvatar(selectedFile);
      showSuccess("Avatar uploaded successfully");
    } catch (error) {
      showError(`Avatar upload failed: ${(error as Error).message}`);
    }
  };

  const handleEditStart = () => {
    originalRef.current = { name, imgUrl };
    setEditing(true);
  };

  const handleEditCancel = () => {
    setName(originalRef.current.name);
    setImgUrl(originalRef.current.imgUrl);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(originalRef.current);
      setEditing(false);
      showSuccess("Profile saved successfully");
    } catch (error) {
      showError(`Save failed: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || isUploadingAvatar;
  const avatarAlt = currentDisplayName || "avatar";
  const saveButtonLabel = saving ? translate("profileSidebar.saving") : translate("profileSidebar.save");
  const showAvatarOverlay = !isUploadingAvatar;

  return (
    <profile-card>
      {/* Avatar + name row */}
      <profile-card-header>
        {editing ? (
          <label className="avatar avatar--upload">
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={isBusy}
              onChange={handleAvatarFileChange}
            />
            <Avatar
              src={avatarUrl}
              alt={avatarAlt}
              initial={initial}
              isLoading={isUploadingAvatar}
            />
            {showAvatarOverlay && (
              <div className="avatar--overlay" />
            )}
          </label>
        ) : (
          <Avatar
            src={avatarUrl}
            alt={avatarAlt}
            initial={initial}
            isLoading={isLoading}
          />
        )}
        <profile-card-info>
          <p className="profile-card__name">
            {nameDisplay}
          </p>
          <p className="profile-card__webid">
            {session.webId}
          </p>
        </profile-card-info>
      </profile-card-header>

      {/* Edit form */}
      {editing && (
        <profile-card-edit>
          <ProfileInput label={translate("profileSidebar.name")} value={name} onChange={setName} disabled={saving} />
          <profile-card-actions>
            <button
              className="btn btn--primary btn--small"
              onClick={handleSave}
              disabled={isBusy}
            >
              {saveButtonLabel}
            </button>
            <button
              className="btn btn--ghost btn--small"
              onClick={handleEditCancel}
              disabled={isBusy}
            >
              {translate("profileSidebar.cancel")}
            </button>
          </profile-card-actions>
        </profile-card-edit>
      )}

      {!editing && (
        <button
          className="btn btn--ghost btn--small profile-card__edit-btn"
          onClick={handleEditStart}
        >
          {translate("profileSidebar.editProfile")}
        </button>
      )}
    </profile-card>
  );
};
