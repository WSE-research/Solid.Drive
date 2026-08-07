/**
 * Login that reports its failures to the user instead of the console.
 *
 * @remarks
 * `useSolidAuth().login` redirects the browser on success, so callers naturally
 * write `void login(...)` and never handle the promise. When it rejects
 * instead — a wrong provider URL, an unreachable server, a provider that is not
 * actually a Solid identity provider — nothing happens on screen: the button
 * appears dead and the reason is only an unhandled rejection in the developer
 * console.
 *
 * This wraps that call, turns the underlying library's terse errors into
 * something a user can act on, and surfaces them through the usual toast.
 *
 * @packageDocumentation
 */

import { useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/shared/contexts/NotificationContext";

/**
 * Turns a login failure into a message that names what went wrong and which
 * provider it went wrong with.
 *
 * The OIDC client raises bare errors such as `HTTP error! Status: 404`, which
 * tell a user nothing. Each branch below maps one real failure mode.
 *
 * @param error - Whatever `login` rejected with.
 * @param issuerUrl - The provider the user was trying to sign in to.
 * @param translate - i18n lookup, passed in so this stays a pure function.
 *
 * @internal
 */
export function describeLoginError(
  error: unknown,
  issuerUrl: string,
  translate: (key: string, options: Record<string, unknown>) => string,
): string {
  const raw = error instanceof Error ? error.message : String(error);

  // The client fetches the provider's OpenID configuration first. A 404 means
  // there is no identity provider at that address -- by far the most common
  // cause, and the one a user can actually fix.
  if (/Status:\s*404/.test(raw)) {
    return translate("auth.loginError.notAProvider", { issuer: issuerUrl });
  }

  // RFC 9207: the provider answered, but announced a different identity than
  // the one requested. Usually a copy-paste slip or a provider behind a
  // redirect; occasionally a genuine misconfiguration worth reporting.
  if (/RFC 9207/.test(raw)) {
    return translate("auth.loginError.issuerMismatch", { issuer: issuerUrl, detail: raw });
  }

  if (/Status:\s*5\d\d/.test(raw)) {
    return translate("auth.loginError.providerUnavailable", { issuer: issuerUrl });
  }

  // fetch() rejects with a TypeError for DNS failures, refused connections and
  // CORS denials; the browser deliberately withholds which.
  if (error instanceof TypeError || /NetworkError|Failed to fetch/i.test(raw)) {
    return translate("auth.loginError.unreachable", { issuer: issuerUrl });
  }

  return translate("auth.loginError.generic", { issuer: issuerUrl, detail: raw });
}

/**
 * Returns a `login(issuerUrl)` that shows the user why a sign-in failed.
 *
 * Resolves to `true` when the redirect was initiated and `false` when it
 * failed, so a caller can keep a spinner honest.
 *
 * @public
 */
export function useLoginWithFeedback(): (issuerUrl: string) => Promise<boolean> {
  const { login } = useSolidAuth();
  const { showError } = useNotifications();
  const [translate] = useTranslation();

  return useCallback(
    async (issuerUrl: string): Promise<boolean> => {
      try {
        await login(issuerUrl, window.location.href);
        return true;
      } catch (error) {
        // Keep the original in the console for developers; the user gets the
        // readable version.
        console.error("Solid login failed", { issuerUrl, error });
        showError(describeLoginError(error, issuerUrl, translate));
        return false;
      }
    },
    [login, showError, translate],
  );
}
