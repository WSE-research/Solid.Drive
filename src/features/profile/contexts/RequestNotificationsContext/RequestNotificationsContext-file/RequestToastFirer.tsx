/**
 * Hidden helper rendered by {@link RequestNotificationsProvider} once
 * per newly-arrived request. Resolves the requester's profile so the
 * toast reads with their real name, falling back to a WebID-derived
 * name after a short timeout if the profile cannot be loaded.
 *
 * @packageDocumentation
 */

import { useEffect, useRef } from "react";
import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { getWebIdFallbackName } from "@/shared/utils";
import { useNotifications } from "@/shared/contexts/NotificationContext";
import { useRequesterProfile } from "@/features/profile/hooks/useRequesterProfile";
import { buildRequestDescription } from "@/features/profile/utils/buildRequestDescription";
import { REQUEST_TOAST_PROFILE_RESOLVE_TIMEOUT_MS } from "@/config";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";

interface RequestToastFirerProps {
  request: AccessRequest;
  onFired: (messageUri: string) => void;
}

/**
 * Fires a single toast for `request`, then calls `onFired` so the
 * provider can drop it from the pending list. Renders nothing.
 *
 * @public
 */
export const RequestToastFirer: FunctionComponent<RequestToastFirerProps> = ({
  request,
  onFired,
}) => {
  const [translate] = useTranslation();
  const { showInfo } = useNotifications();
  const { profileLoading, displayName } = useRequesterProfile(request.requesterWebId);
  const firedRef = useRef(false);

  const fire = (name: string) => {
    if (firedRef.current) return;
    firedRef.current = true;
    const description = buildRequestDescription(request, translate);
    showInfo(
      translate("requestNotifications.toast", {
        name,
        description,
        defaultValue: "{{name}} {{description}}",
      }),
    );
    onFired(request.messageUri);
  };

  useEffect(() => {
    if (firedRef.current || profileLoading) return;
    fire(displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, displayName]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fire(getWebIdFallbackName(request.requesterWebId));
    }, REQUEST_TOAST_PROFILE_RESOLVE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
