/**
 * Profile sidebar component displaying user info and contacts.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useSubject, useSolidAuth } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { resolveCatalogUri } from "@/infrastructure/solid/catalog";
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
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const ownerWebId = session.webId ?? "";
  const storageRoot =
    profile?.storage?.toArray()?.[0]?.["@id"] ??
    ownerWebId.replace(/\/profile\/card.*/, "/");
  const catalogUri = resolveCatalogUri(profile, storageRoot);

  return (
    <aside className="profile-sidebar">
      <div className="profile-sidebar__card">
        <ProfileCard />
        <hr className="profile-sidebar__divider" />
        <ContactsList ownerWebId={ownerWebId} />
        {ownerWebId && storageRoot && catalogUri && (
          <>
            <hr className="profile-sidebar__divider" />
            <RequestsPanel
              ownerWebId={ownerWebId}
              storageRoot={storageRoot}
              catalogUri={catalogUri}
            />
          </>
        )}
      </div>
    </aside>
  );
};
