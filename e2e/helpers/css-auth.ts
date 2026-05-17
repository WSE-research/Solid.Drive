import { Session } from "@inrupt/solid-client-authn-node";
import { URLS } from "../config";

type Credentials = { id: string; secret: string };

/** Logs into a CSS account and creates a client-credentials token bound to the given WebID. */
async function createClientCredentials(
  email: string,
  password: string,
  webId: string,
  name: string,
): Promise<Credentials> {
  const indexResponse = await fetch(`${URLS.css}.account/`);
  if (!indexResponse.ok) {
    throw new Error(`GET ${URLS.css}.account/ returned ${indexResponse.status}`);
  }
  const index = await indexResponse.json();
  const loginUrl = index.controls.password.login;

  const loginResponse = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Password login for ${email} failed: ${loginResponse.status}`);
  }
  const { authorization } = await loginResponse.json();

  const authedIndexResponse = await fetch(`${URLS.css}.account/`, {
    headers: { Authorization: `CSS-Account-Token ${authorization}` },
  });
  const authedIndex = await authedIndexResponse.json();
  const credentialsUrl = authedIndex.controls.account.clientCredentials;

  const credentialsResponse = await fetch(credentialsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `CSS-Account-Token ${authorization}`,
    },
    body: JSON.stringify({ name, webId }),
  });
  if (!credentialsResponse.ok) {
    throw new Error(`Client-credentials creation failed: ${credentialsResponse.status}`);
  }
  const { id, secret } = await credentialsResponse.json();
  return { id, secret };
}

/**
 * Returns a DPoP-bound `fetch` authenticated as the given WebID. The token
 * is created via the CSS account API with a fresh client-credentials pair.
 *
 * @param email - CSS account email
 * @param password - CSS account password
 * @param webId - the WebID the token should bind to
 * @param sessionLabel - label for the credentials record; tests can reuse a shared value
 * @returns a `fetch` that signs requests for the bound WebID
 */
export async function getAuthenticatedFetch(
  email: string,
  password: string,
  webId: string,
  sessionLabel = "e2e-test",
): Promise<typeof fetch> {
  const { id, secret } = await createClientCredentials(email, password, webId, sessionLabel);
  const session = new Session();
  await session.login({
    clientId: id,
    clientSecret: secret,
    oidcIssuer: URLS.css,
    tokenType: "DPoP",
  });
  if (!session.info.isLoggedIn) {
    throw new Error(`Authentication for ${webId} failed`);
  }
  return session.fetch as typeof fetch;
}
