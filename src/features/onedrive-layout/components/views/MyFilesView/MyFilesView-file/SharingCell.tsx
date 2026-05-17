/**
 * Sharing column cell. Calls useSharingLabel and renders a localized
 * label: "Private" / "Public" / "{name}" / "N people".
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSharingLabel } from '@/features/onedrive-layout/hooks/useSharingLabel';
import { useContactProfile } from '@/shared/hooks/useContactProfile';

interface SharingCellProps {
  uri: string;
}

/**
 * Resolves a single agent's WebID into their display name via the
 * shared {@link useContactProfile} hook so SharePanel, HasAccessRow,
 * and this cell all surface the same name. The WebID is preserved as
 * a `title` attribute so it stays discoverable via tooltip.
 */
const FirstAgentName: FunctionComponent<{ webId: string }> = ({ webId }) => {
  const { displayName } = useContactProfile(webId);
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
