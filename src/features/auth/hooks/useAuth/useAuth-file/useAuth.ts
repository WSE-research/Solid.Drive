/**
 * @packageDocumentation
 * Handles user authentication with Solid Pods.
 */

import { useSolidAuth } from "@ldo/solid-react";

export interface UseAuthReturn {
  session: ReturnType<typeof useSolidAuth>["session"];
  webId: string | undefined;
  isLoggedIn: boolean;
  login: (issuerUrl: string, redirectUri: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Manages Solid Pod authentication in React components.
 *
 * @remarks
 * A thin wrapper around useSolidAuth that exposes only what most
 * components need: login state, WebID, and auth actions.
 *
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { isLoggedIn, login, logout } = useAuth();
 *   if (isLoggedIn) {
 *     return <button onClick={logout}>Logout</button>;
 *   }
 *   return <button onClick={() => login('https://solidcommunity.net')}>Login</button>;
 * }
 * ```
 *
 * @public
 */
export function useAuth(): UseAuthReturn {
  const { session, login, logout } = useSolidAuth();
  return {
    session,
    webId: session.webId,
    isLoggedIn: session.isActive,
    login,
    logout,
  };
}
