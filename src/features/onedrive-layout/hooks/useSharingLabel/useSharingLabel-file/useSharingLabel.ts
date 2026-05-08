/**
 * Resolves a Solid resource URI into a sharing kind ('private' | 'public' |
 * 'shared') by reading the resource's WAC ACL. Used by the file table's
 * Sharing column.
 *
 * @packageDocumentation
 */

import { useEffect, useState } from 'react';
import { useSolidAuth } from '@ldo/solid-react';
import { discoverAclUri, readAclAgents } from '@/infrastructure/wac/aclManager';
import { useAclVersion } from '@/shared/hooks/useAclVersion';

const FOAF_AGENT = 'http://xmlns.com/foaf/0.1/Agent';

export type SharingKind = 'private' | 'public' | 'shared';

export interface SharingLabel {
  kind: SharingKind;
  agentWebIds: string[];
  loading: boolean;
}

const DEFAULT: SharingLabel = { kind: 'private', agentWebIds: [], loading: false };
const LOADING: SharingLabel = { kind: 'private', agentWebIds: [], loading: true };

interface ResolvedLabel {
  uri: string;
  label: SharingLabel;
}

export function useSharingLabel(uri: string | undefined): SharingLabel {
  const { session, fetch: solidFetch } = useSolidAuth();
  const ownerWebId = session.webId;
  const aclVersion = useAclVersion(uri);
  const [resolved, setResolved] = useState<ResolvedLabel | null>(null);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;

    void (async () => {
      try {
        const aclUri = await discoverAclUri(uri, solidFetch);
        const agents = await readAclAgents(aclUri, solidFetch);
        if (cancelled) return;

        if (agents.includes(FOAF_AGENT)) {
          setResolved({
            uri,
            label: { kind: 'public', agentWebIds: [], loading: false },
          });
          return;
        }

        const others = agents.filter((agent) => agent !== ownerWebId);
        setResolved({
          uri,
          label: {
            kind: others.length > 0 ? 'shared' : 'private',
            agentWebIds: others,
            loading: false,
          },
        });
      } catch {
        if (!cancelled) setResolved({ uri, label: DEFAULT });
      }
    })();

    return () => { cancelled = true; };
  }, [uri, ownerWebId, solidFetch, aclVersion]);

  if (!uri) return DEFAULT;
  if (resolved?.uri === uri) return resolved.label;
  return LOADING;
}
