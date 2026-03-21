import { useState } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSolidAuth, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "./.ldo/solidProfile.shapeTypes";
import { isLoadable } from "./pod";

const KNOWN_PROVIDERS = [
  { label: "solidcommunity.net", value: "https://solidcommunity.net", registerUrl: "https://solidcommunity.net/register" },
  { label: "inrupt.net", value: "https://inrupt.net", registerUrl: "https://signup.pod.inrupt.com/" },
  { label: "solidweb.org", value: "https://solidweb.org", registerUrl: "https://solidweb.org/register" },
  { label: "Custom…", value: "custom", registerUrl: undefined },
];

const CUSTOM_PROVIDER_VALUE = "custom";

export const Header: FunctionComponent = () => {
  const { session, login, logout } = useSolidAuth();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [customIssuerUrl, setCustomIssuerUrl] = useState("");

  const webIdResource = useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const displayName = isLoadable(webIdResource) && webIdResource.isLoading()
    ? "Loading…"
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
            Logged in as <strong>{displayName}</strong>
          </p>
          <button className="btn btn-ghost" onClick={logout}>
            Log Out
          </button>
        </div>
      ) : (
        <div className="auth-logged-out">
          <div className="auth-input-row">
            <div className="auth-field">
              <label className="auth-provider-label">Provider</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={selectedProvider}
                  onChange={(error) => setSelectedProvider(error.target.value)}
                >
                  <option value="" disabled>Select a provider</option>
                  {KNOWN_PROVIDERS.map((provider) => (
                    <option key={provider.value} value={provider.value}>{provider.label}</option>
                  ))}
                </select>
                {selectedProvider === CUSTOM_PROVIDER_VALUE && (
                  <input
                    type="text"
                    value={customIssuerUrl}
                    onChange={(error) => setCustomIssuerUrl(error.target.value)}
                    placeholder="https://your-provider.example"
                  />
                )}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => login(issuerUrl)}
              disabled={!issuerUrl}
            >
              Log In
            </button>
          </div>
          <span className="auth-signup">
            <span className="auth-signup-text">
              A Pod is your personal data store on the web.{" "}
              <a href="https://solidproject.org/about" target="_blank" rel="noopener noreferrer" className="auth-hint-link">
                Learn more.
              </a>
            </span>
            <span className="auth-signup-text">·</span>
            <a
              href={registerUrl ?? "https://solidproject.org/users/get-a-pod"}
              target="_blank"
              rel="noopener noreferrer"
              className="auth-hint-link"
            >
              Create a Pod
            </a>
          </span>
        </div>
      )}
    </header>
  );
};
