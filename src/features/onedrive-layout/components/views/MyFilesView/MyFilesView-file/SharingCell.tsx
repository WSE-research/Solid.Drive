/**
 * Sharing column cell. Calls useSharingLabel and renders a localized
 * label: "Private" / "Public" / "{name}" / "N people".
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useResource, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { useSharingLabel } from '@/features/onedrive-layout/hooks/useSharingLabel';

interface SharingCellProps {
  uri: string;
}

/**
 * Resolves a single agent's WebID into their human-readable display
 * name (foaf:name / vcard:fn). Falls back to the raw WebID when the
 * profile document can't be loaded. The WebID is preserved as a
 * `title` attribute so it stays discoverable via tooltip.
 */
const FirstAgentName: FunctionComponent<{ webId: string }> = ({ webId }) => {
  // Trigger the profile document fetch so useSubject has data to bind to;
  // without this, the hook returns undefined and we fall back to the WebID.
  void useResource(webId);
  const profile = useSubject(SolidProfileShapeType, webId);
  const displayName = profile?.fn ?? profile?.name ?? webId;
  return <span title={webId}>{displayName}</span>;
};

/**
 * Single-row Sharing column cell. Renders a localized label that
 * reflects the resource's WAC ACL: "Private", "Public", a single
 * agent's display name, or "{N} people" for multi-agent shares.
 *
 * @public
 */
export const SharingCell: FunctionComponent<SharingCellProps> = ({ uri }) => {
  const [translate] = useTranslation();
  const { kind, agentWebIds, loading } = useSharingLabel(uri);

  if (loading) {
    return <span className="odl-sharing-cell odl-sharing-cell--loading">…</span>;
  }
  if (kind === 'public') {
    return (
      <span className="odl-sharing-cell">
        {translate('oneDriveLayout.sharing.public', 'Public')}
      </span>
    );
  }
  if (kind === 'shared') {
    const [first, ...rest] = agentWebIds;
    if (first && rest.length === 0) {
      return (
        <span className="odl-sharing-cell">
          <FirstAgentName webId={first} />
        </span>
      );
    }
    return (
      <span className="odl-sharing-cell">
        {translate('oneDriveLayout.sharing.shared_other', '{{count}} people', {
          count: agentWebIds.length,
        })}
      </span>
    );
  }
  return (
    <span className="odl-sharing-cell">
      {translate('oneDriveLayout.sharing.private', 'Private')}
    </span>
  );
};
