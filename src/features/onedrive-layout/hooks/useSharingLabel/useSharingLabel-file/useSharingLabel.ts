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
import { RDF_NAMESPACES } from '@/config';

const FOAF_AGENT = `${RDF_NAMESPACES.FOAF}Agent`;

export type SharingKind = 'private' | 'public' | 'shared';

export interface SharingLabel {
  kind: SharingKind;
  agentWebIds: string[];
  loading: boolean;
}

const DEFAULT: SharingLabel = { kind: 'private', agentWebIds: [], loading: false };
const LOADING: SharingLabel = { kind: 'private', agentWebIds: [], loading: true };

interface CacheEntry {
  version: number;
  label: SharingLabel;
}

// Module-level cache shared by every consumer. Without this, each row in
// MyFilesTable fires two sequential Pod requests (discoverAclUri +
// readAclAgents) on every mount, which is the dominant loading cost for
// a folder with more than a handful of files. Invalidated per-URI when
// the ACL version bumps.
const cache = new Map<string, CacheEntry>();

// Dedupe concurrent fetches for the same uri+version so N rows mounting
// at once share one in-flight request instead of triggering N parallel
// duplicates.
const inflight = new Map<string, Promise<SharingLabel>>();

function buildLabel(agents: string[], ownerWebId: string | undefined): SharingLabel {
  if (agents.includes(FOAF_AGENT)) {
    return { kind: 'public', agentWebIds: [], loading: false };
  }
  const others = agents.filter((agent) => agent !== ownerWebId);
  return {
    kind: others.length > 0 ? 'shared' : 'private',
    agentWebIds: others,
    loading: false,
  };
}

/**
 * Resolves a Solid resource URI into its sharing state by reading the
 * companion WAC ACL. Returns `loading: true` until the first fetch
 * settles, then a stable label until the ACL version is bumped.
 *
 * @public
 */
export function useSharingLabel(uri: string | undefined): SharingLabel {
  const { session, fetch: solidFetch } = useSolidAuth();
  const ownerWebId = session.webId;
  const aclVersion = useAclVersion(uri);
  // forceUpdate just wakes this consumer when its uri+version fetch
  // resolves; the actual data lives in the module cache.
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!uri) return;
    const cached = cache.get(uri);
    if (cached && cached.version === aclVersion) return;

    let cancelled = false;
    const inflightKey = `${uri}#${aclVersion}`;
    let promise = inflight.get(inflightKey);
    if (!promise) {
      promise = (async () => {
        try {
          const aclUri = await discoverAclUri(uri, solidFetch);
          const agents = await readAclAgents(aclUri, solidFetch);
          const label = buildLabel(agents, ownerWebId);
          cache.set(uri, { version: aclVersion, label });
          return label;
        } catch {
          cache.set(uri, { version: aclVersion, label: DEFAULT });
          return DEFAULT;
        } finally {
          inflight.delete(inflightKey);
        }
      })();
      inflight.set(inflightKey, promise);
    }

    void promise.then(() => {
      if (!cancelled) forceUpdate((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [uri, ownerWebId, solidFetch, aclVersion]);

  if (!uri) return DEFAULT;
  const cached = cache.get(uri);
  if (cached && cached.version === aclVersion) return cached.label;
  return LOADING;
}

/**
 * Test-only helper that wipes the module cache. Required because the
 * cache survives across `renderHook` calls within a single test file.
 *
 * @internal
 */
export function __resetSharingLabelCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
