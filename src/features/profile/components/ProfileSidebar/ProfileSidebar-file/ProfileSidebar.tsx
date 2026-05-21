/**
 * Profile sidebar component displaying user info and contacts.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { ProfileCard } from "@/features/profile/components/ProfileCard";
import { ContactsList } from "@/features/profile/components/ContactsList";
import { RequestsPanel } from "@/features/profile/components/RequestsPanel";

/**
 * Sidebar displaying profile card, contacts list, and access requests panel.
 *
 * @public
 */
export const ProfileSidebar: FunctionComponent = () => {
  const { session } = useSolidAuth();
  const ownerWebId = session.webId ?? "";

  return (
    <aside className="profile-sidebar">
      <profile-sidebar-card>
        <ProfileCard />
        <hr className="profile-sidebar__divider" />
        <ContactsList ownerWebId={ownerWebId} />
        {ownerWebId && (
          <>
            <hr className="profile-sidebar__divider" />
            <RequestsPanel />
          </>
        )}
      </profile-sidebar-card>
    </aside>
  );
};
