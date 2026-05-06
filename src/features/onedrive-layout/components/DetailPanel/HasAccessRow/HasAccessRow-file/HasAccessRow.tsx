/**
 * Horizontal strip of avatar circles for the DetailPanel's "Has access"
 * row. Renders one circle per non owner agent in the WAC ACL, a single
 * Public marker for resources shared with foaf:Agent, or an empty row
 * for private resources.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSharingLabel } from '@/features/onedrive-layout/hooks/useSharingLabel';
import { Avatar } from '@/shared/components/Avatar';
import { useContactProfile } from '@/shared/hooks/useContactProfile';

interface HasAccessRowProps {
  uri: string;
}

/**
 * Renders a single agent's avatar circle. Resolves the WebID into a
 * display name + initial via {@link useContactProfile} so the SharePanel,
 * the contacts list, and this row all render the same name and avatar
 * for a given WebID.
 */
const AccessAvatar: FunctionComponent<{ webId: string }> = ({ webId }) => {
  const [translate] = useTranslation();
  const { displayName, avatarUrl, initial, isLoading } = useContactProfile(webId);
  const ariaLabel = translate(
    'oneDriveLayout.details.sharedWith',
    'Shared with {{name}}',
    { name: displayName },
  );
  return (
    <span role="img" aria-label={ariaLabel} title={webId} className="odl-access-avatar">
      <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
    </span>
  );
};

/**
 * Renders the "Has access" strip for the DetailPanel. See file docs.
 *
 * @public
 */
export const HasAccessRow: FunctionComponent<HasAccessRowProps> = ({ uri }) => {
  const [translate] = useTranslation();
  const { kind, agentWebIds, loading } = useSharingLabel(uri);

  if (loading || kind === 'private') {
    return <has-access-row />;
  }

  if (kind === 'public') {
    return (
      <has-access-row>
        <span className="odl-access-avatar odl-access-avatar--public">
          {translate('oneDriveLayout.sharing.public', 'Public')}
        </span>
      </has-access-row>
    );
  }

  return (
    <has-access-row>
      {agentWebIds.map((webId) => (
        <AccessAvatar key={webId} webId={webId} />
      ))}
    </has-access-row>
  );
};
