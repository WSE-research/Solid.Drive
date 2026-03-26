import { useState } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isLoadable } from "./pod";
import { LanguageSwitcher } from "./LanguageSwitcher";

const KNOWN_PROVIDERS = [
  { label: "solidcommunity.net", value: "https://solidcommunity.net", registerUrl: "https://solidcommunity.net/register" },
  { label: "inrupt.net", value: "https://inrupt.com", registerUrl: "https://start.inrupt.com/profile" },
  { label: "solidweb.org", value: "https://solidweb.org", registerUrl: "https://solidweb.org/register" },
  { label: "Custom…", value: "custom", registerUrl: undefined },
];

const CUSTOM_PROVIDER_VALUE = "custom";

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
  const registerUrl = KNOWN_PROVIDERS.find((provider) => provider.value === selectedProvider)?.registerUrl;

  return (
    <header className="site-header">
      <div className="site-header__brand">
        solid<span>.</span>drive
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
                  onChange={(error) => setSelectedProvider(error.target.value)}
                >
                  <option value="" disabled>{translate("header.selectProvider")}</option>
                  {KNOWN_PROVIDERS.map((provider) => (
                    <option key={provider.value} value={provider.value}>{provider.label}</option>
                  ))}
                </select>
                {selectedProvider === CUSTOM_PROVIDER_VALUE && (
                  <input
                    type="text"
                    value={customIssuerUrl}
                    onChange={(error) => setCustomIssuerUrl(error.target.value)}
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
              <a href="https://solidproject.org/about" target="_blank" rel="noopener noreferrer" className="auth-hint-link">
                {translate("header.learnMore")}
              </a>
            </span>
            <span className="auth-signup-text">·</span>
            <a
              href={registerUrl ?? "https://solidproject.org/users/get-a-pod"}
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
