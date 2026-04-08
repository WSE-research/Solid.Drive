/**
 * Site header with Solid authentication controls.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable } from "@/infrastructure/solid/resourceGuards";
import { LanguageSwitcher } from "@/features/auth/components/LanguageSwitcher";
import { APP_NAME, SOLID_PROVIDERS, CUSTOM_PROVIDER_VALUE, EXTERNAL_LINKS } from "@/config";

/**
 * Renders the site header and handles Solid authentication state.
 * Displays provider selection when logged out, user info when logged in.
 *
 * @public
 */
export const Header: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session, login, logout } = useSolidAuth();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [customIssuerUrl, setCustomIssuerUrl] = useState("");

  const webIdResource = useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const displayName = isLoadable(webIdResource) && webIdResource.isLoading()
    ? translate("header.loading", "Loading…")
    : profile?.fn || profile?.name || session.webId;

  const issuerUrl = selectedProvider === CUSTOM_PROVIDER_VALUE ? customIssuerUrl : selectedProvider;
  const registerUrl = SOLID_PROVIDERS.find((provider) => provider.value === selectedProvider)?.registerUrl;

  return (
    <header className="site-header">
      <div className="site-header__brand">
        {APP_NAME}
      </div>

      {session.isLoggedIn ? (
        <div className="auth-logged-in">
          <p className="auth-webid">
            {translate("header.loggedInAs")} <strong>{displayName}</strong>
          </p>
          <LanguageSwitcher />
          <button className="btn btn--ghost" onClick={logout}>
            {translate("header.logOut")}
          </button>
        </div>
      ) : (
        <div className="auth-logged-out">
          <div className="auth-input-row">
            <div className="auth-field">
              <label className="auth-provider-label">{translate("header.provider")}</label>
              <div className="auth-provider-row">
                <select
                  value={selectedProvider}
                  onChange={(event) => setSelectedProvider(event.target.value)}
                >
                  <option value="" disabled>{translate("header.selectProvider")}</option>
                  {SOLID_PROVIDERS.map((provider) => (
                    <option key={provider.value} value={provider.value}>{provider.label}</option>
                  ))}
                </select>
                {selectedProvider === CUSTOM_PROVIDER_VALUE && (
                  <input
                    type="text"
                    value={customIssuerUrl}
                    onChange={(event) => setCustomIssuerUrl(event.target.value)}
                    placeholder={translate("header.customProviderPlaceholder")}
                  />
                )}
              </div>
            </div>
            <LanguageSwitcher />
            <button
              className="btn btn--primary"
              onClick={() => login(issuerUrl)}
              disabled={!issuerUrl}
            >
              {translate("header.logIn")}
            </button>
          </div>
          <span className="auth-signup">
            <span className="auth-signup-text">
              {translate("header.podDescription")}{" "}
              <a href={EXTERNAL_LINKS.solidProjectAbout} target="_blank" rel="noopener noreferrer" className="auth-hint-link">
                {translate("header.learnMore")}
              </a>
            </span>
            <span className="auth-signup-text">·</span>
            <a
              href={registerUrl ?? EXTERNAL_LINKS.defaultGetPod}
              target="_blank"
              rel="noopener noreferrer"
              className="auth-hint-link"
            >
              {translate("header.createPod")}
            </a>
          </span>
        </div>
      )}
    </header>
  );
};
