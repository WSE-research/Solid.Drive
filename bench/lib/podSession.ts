/**
 * @packageDocumentation
 * The shared entry point every network runner calls to get an authenticated
 * session against a Solid server, so none of them repeats account creation and
 * token exchange. 
 * 
 * `provisionSession` makes a fresh CSS account and
 * pod so one run's data can't interfere with another's, and returns the authenticated
 * fetch with the pod, the WebID, and the server's own header for the results.
 */
 
import { 
  createKeys, 
  getToken, 
  importKeys, 
  makeRefreshingAuthFetch, 
  provision, 
  type AuthFetch, 
  type Credentials, 
  type DpopKeys, 
} from "./auth";

// Fetch function that refreshes the access token when it expires.
async function refreshingSession(issuer: string, credentials: Credentials, keys: DpopKeys): Promise<AuthFetch> {
  const tokenSource = (): Promise<string> => getToken(issuer, credentials, keys);
  const token = await tokenSource();
  return makeRefreshingAuthFetch(tokenSource, keys, token);
}

export interface PodSession {
  authFetch: AuthFetch;
  pod: string;
  webId: string;
  serverHeader: string;
}

/**
 * Creates an authenticated pod session for the benchmark.
 *
 * If `BENCH_ACCESS_TOKEN` is set, the supplied DPoP-bound token and key are
 * used directly. This mode does not support automatic token renewal.
 *
 * If `BENCH_CLIENT_ID` is set, the supplied client credentials, pod, and WebID
 * are used instead of provisioning a new account.
 *
 * Otherwise, a new account and pod are provisioned on `baseUrl`.
 */
export async function provisionSession(baseUrl: string, suffix: string): Promise<PodSession> {
  const serverHeader = (await fetch(baseUrl).then((response) => response.headers.get("server")).catch(() => null)) ?? "unknown";

  const seededToken = process.env.BENCH_ACCESS_TOKEN;
  if (seededToken) {
    const keys = await importKeys(JSON.parse(process.env.BENCH_DPOP_JWK ?? "{}"));
    const pod = (process.env.BENCH_POD ?? baseUrl).replace(/\/?$/, "/");
    const onExpiry = (): Promise<string> => Promise.reject(
      new Error("seeded access token expired; re-mint it (see second-server runbook)"),
    );
    return { authFetch: makeRefreshingAuthFetch(onExpiry, keys, seededToken), pod, webId: process.env.BENCH_WEBID ?? "", serverHeader };
  }

  const keys = await createKeys();

  const clientId = process.env.BENCH_CLIENT_ID;
  if (clientId) {
    const credentials = { id: clientId, secret: process.env.BENCH_CLIENT_SECRET ?? "" };
    const issuer = process.env.BENCH_ISSUER ?? baseUrl;
    const pod = (process.env.BENCH_POD ?? baseUrl).replace(/\/?$/, "/");
    return { authFetch: await refreshingSession(issuer, credentials, keys), pod, webId: process.env.BENCH_WEBID ?? "", serverHeader };
  }

  const { podUrl, webId, credentials } = await provision(baseUrl, suffix);
  return { authFetch: await refreshingSession(baseUrl, credentials, keys), pod: podUrl, webId, serverHeader };
}
