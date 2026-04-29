import { Session } from "@inrupt/solid-client-authn-node";

export const CSS_BASE_URL = "http://localhost:3001/";

type Credentials = { id: string; secret: string };

/**
 * Logs into a CSS account via the password endpoint and creates a
 * client-credentials token bound to the given WebID.
 */
async function createClientCredentials(
  email: string,
  password: string,
  webId: string,
  name: string,
): Promise<Credentials> {
  const indexResponse = await fetch(`${CSS_BASE_URL}.account/`);
  if (!indexResponse.ok) {
    throw new Error(`GET ${CSS_BASE_URL}.account/ returned ${indexResponse.status}`);
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

  const authedIndexResponse = await fetch(`${CSS_BASE_URL}.account/`, {
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
 * Returns a DPoP-bound `fetch` authenticated as the given WebID.
 *
 * @param email - CSS account email
 * @param password - CSS account password
 * @param webId - the WebID the token should bind to
 * @param sessionLabel - free-form label for the credentials (tests can reuse)
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
    oidcIssuer: CSS_BASE_URL,
    tokenType: "DPoP",
  });
  if (!session.info.isLoggedIn) {
    throw new Error(`Authentication for ${webId} failed`);
  }
  return session.fetch as typeof fetch;
}
