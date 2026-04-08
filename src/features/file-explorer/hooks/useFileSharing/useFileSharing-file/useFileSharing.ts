/**
 * @packageDocumentation
 * Checks if a resource has been shared with other users.
 */

import { useReducer, useEffect } from "react";
import { discoverAclUri, readAclAgents } from "@/infrastructure/wac/aclManager";

type State = { isShared: boolean };
type Action = { type: "SET_SHARED"; payload: boolean };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "SET_SHARED":
      return { isShared: action.payload };
    default:
      return _state;
  }
}

/**
 * Returns true if the resource's ACL grants access to other agents.
 *
 * @param containerUri - URI of the resource to check
 * @param solidFetch - Authenticated fetch function
 *
 * @public
 */
export function useFileSharing(
  containerUri: string | undefined,
  solidFetch: (url: RequestInfo, init?: RequestInit) => Promise<Response>
): boolean {
  const [state, dispatch] = useReducer(reducer, { isShared: false });

  useEffect(() => {
    if (!containerUri) return;
    
    let cancelled = false;
    
    discoverAclUri(containerUri, solidFetch)
      .then((aclUri) => readAclAgents(aclUri, solidFetch))
      .then((sharedAgents) => {
        if (!cancelled) {
          dispatch({ type: "SET_SHARED", payload: sharedAgents.length > 0 });
        }
      })
      .catch((err) => {
        console.warn("[useFileSharing] ACL discovery failed for", containerUri, err);
        if (!cancelled) {
          dispatch({ type: "SET_SHARED", payload: false });
        }
      });
    
    return () => {
      cancelled = true;
    };
  }, [containerUri, solidFetch]);

  return containerUri ? state.isShared : false;
}
