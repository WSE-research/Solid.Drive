/**
 * @packageDocumentation
 * Provides authenticated Solid sessions for the evaluation environment.(RFC 9449)
 * 
 * This replicates the same used by a real Solid client, so
 * every latency measurement in the benchmark reflects a properly authenticated request.
 * 
 * This module signs DPoP proof JWTs (JSON Web Token), provisions a fresh
 * Community Solid Server (CSS) account and pod through its API, 
 * and exchanges client credentials for a WebID-scoped, DPoP-bound access token..
 */

import { webcrypto } from "node:crypto";
import type { FetchFn } from "@/types/solid";

const { subtle } = webcrypto;

/**
 * The public half of a P-256 DPoP key, as the four fields RFC 7517 (JWK)
 * requires for an EC public key: `kty`, `crv`, `x`, `y`. This is exactly the
 * shape a DPoP proof header carries, so it goes onto the wire unchanged.
 */
export interface EcPublicKey {
  kty: string | undefined;
  crv: string | undefined;
  x: string | undefined;
  y: string | undefined;
}

/**
 * A DPoP (Demonstrating Proof of Possession, RFC 9449) key pair.
 *
 * DPoP requires the client to sign a proof with the private key for each request.
 * The private key remains with the client, while the public JWK is
 * included in the proof for server-side verification.
 */
export interface DpopKeys {
  privateKey: webcrypto.CryptoKey;
  publicKey: EcPublicKey;
}

/**
 * Client credentials issued by the Solid server when a benchmark account is provisioned.
 * The client ID and secret are exchanged for an access token using the
 * OAuth client credentials grant.
 */
export interface Credentials {
  id: string;
  secret: string;
}

/**
 * The benchmark account. 
 * 
 * `podUrl` -- identifies the root of the Solid pod.
 * `webId` -- identifies the account owner and is used by access control to grant or deny access to a resource.
 * `credentials` -- is what `getToken` needs to authenticate as that pod's owner.
 */
export interface Provisioned {
  podUrl: string;
  webId: string;
  credentials: Credentials;
}

// Defines the request options used by this module.
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}

// An authenticated fetch function that adds DPoP and access-token headers.
export type AuthFetch = (url: string, init?: FetchInit) => Promise<Response>;

/**
 * Adapts an authenticated fetch function to the `FetchFn` interface.
 * 
 * This assumes that services use URL strings and the supported `FetchInit` fields only.
 */
export function toFetchFn(authFetch: AuthFetch): FetchFn {
  return authFetch as unknown as FetchFn;
}

// Encodes data using the Base64url format defined in RFC 4648, Section 5.
const b64url = (input: string | Uint8Array): string => {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Extracts the public EC key fields required for a DPoP proof.
function ecPublicKey(jwk: JsonWebKey): EcPublicKey {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

// Generates a P-256 key pair for signing DPoP proofs.
export async function createKeys(): Promise<DpopKeys> {
  const { publicKey: cryptoPublicKey, privateKey } = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  );
  const jwk = await subtle.exportKey("jwk", cryptoPublicKey);
  return { privateKey, publicKey: ecPublicKey(jwk) };
}

/**
 * Reconstructs a DPoP key pair from a P-256 private JWK.
 *
 * This is used when an existing access token is already bound to a
 * specific key.
 */
export async function importKeys(privateJwk: JsonWebKey): Promise<DpopKeys> {
  const privateKey = await subtle.importKey(
    "jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  return { privateKey, publicKey: ecPublicKey(privateJwk) };
}

interface ProofOptions {
  nonce?: string;
  // Access token associated with the proof.
  accessToken?: string;
}

/**
 * Creates a signed DPoP proof for an HTTP request.
 * 
 * The proof binds the request method and URL to the supplied key pair.
 * When provided, the nonce and access token are included in the proof.
 */
export async function proof(keys: DpopKeys, method: string, url: string, { nonce, accessToken }: ProofOptions = {}): Promise<string> {
  const htu = new URL(url);
  htu.search = "";
  htu.hash = "";
  const header = { alg: "ES256", typ: "dpop+jwt", jwk: keys.publicKey };
  const payload: Record<string, unknown> = {
    htu: htu.toString(), htm: method.toUpperCase(),
    jti: webcrypto.randomUUID(), iat: Math.floor(Date.now() / 1000),
  };

  if (nonce) payload.nonce = nonce;
  if (accessToken) {
    const digest = await subtle.digest("SHA-256", Buffer.from(accessToken, "utf8"));
    payload.ath = b64url(new Uint8Array(digest));
  }

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, keys.privateKey, Buffer.from(signingInput, "utf8"),
  );

  return `${signingInput}.${b64url(new Uint8Array(signature))}`;
}

// Returns a new DPoP nonce provided by the server, if its available.
function nextNonce(response: Response, current: string | undefined): string | undefined {
  const fresh = response.headers.get("dpop-nonce");
  return fresh && fresh !== current ? fresh : undefined;
}

/**
 * Creates an authenticated fetch function with token refresh support.
 * 
 * Requests include the required DPoP and access-token headers. The function
 * retries requests after a DPoP nonce challenge and refreshes expired access
 * tokens when required.
 */
export function makeRefreshingAuthFetch(refreshToken: () => Promise<string>, keys: DpopKeys, initialToken: string): AuthFetch {
  const MAX_ATTEMPTS = 4;
  let token = initialToken;
  let pending: Promise<string> | null = null;
  const refresh = (): Promise<string> => {
    if (!pending) pending = refreshToken().then((fresh) => { token = fresh; return fresh; }).finally(() => { pending = null; });
    return pending;
  };

  return async (url, { method = "GET", headers = {}, body } = {}) => {
    let nonce: string | undefined;
    let refreshed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const response = await fetch(url, {
        method,
        headers: { ...headers, DPoP: await proof(keys, method, url, { nonce, accessToken: token }), Authorization: `DPoP ${token}` },
        body: body as BodyInit | null | undefined,
      });

      const fresh = nextNonce(response, nonce);
      if ((response.status === 401 || response.status === 400) && fresh) {
        nonce = fresh; await response.text(); continue;
      }
      if (response.status === 401 && !refreshed) {
        refreshed = true; await response.text();
        await refresh(); nonce = undefined; continue;
      }
      return response;
    }
    throw new Error("refreshing auth fetch: exhausted retries after token refresh");
  };
}

// Defines the parts of the CSS account API responses used during provisioning. 
interface AccountControls {
  account: { create: string; pod: string; clientCredentials: string };
  password: { create: string };
}
interface AccountResource {
  controls: AccountControls;
}
interface AccountCreated {
  authorization: string;
}
interface PodCreated {
  pod: string;
  webId: string;
}
interface OidcDiscovery {
  token_endpoint: string;
}

// Fetches a JSON resource and parses its response.
async function fetchJson<T = unknown>(url: string | URL, init: FetchInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { accept: "application/json", ...(init.headers ?? {}) } } as RequestInit);
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url} -> ${response.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// Sends a JSON POST request and parses the response.
function postJson<T = unknown>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  return fetchJson<T>(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

/**
 * Provisions a new CSS account and pod for the benchmark.
 *
 * A separate account is used for each run to prevent shared state from
 * affecting the measurements.
 * 
 * @param baseUrl The base URL of the CSS server.
 * @param suffix A unique identifier for the benchmark run.
 * @returns A promise resolving to the provisioned account and pod information.
 */

export async function provision(baseUrl: string, suffix: string): Promise<Provisioned> {
  const accountUrl = new URL(".account/", baseUrl);
  const index = await fetchJson<AccountResource>(accountUrl);
  const created = await postJson<AccountCreated>(index.controls.account.create, {});

  const auth = { authorization: `CSS-Account-Token ${created.authorization}` };
  const controls = (await fetchJson<AccountResource>(accountUrl, { headers: auth })).controls;
  await postJson(controls.password.create, { email: `bench-${suffix}@example.invalid`, password: `pw-${suffix}` }, auth);

  const pod = await postJson<PodCreated>(controls.account.pod, { name: `bench-${suffix}` }, auth);
  const credentials = await postJson<Credentials>(controls.account.clientCredentials, { name: `bench-${suffix}`, webId: pod.webId }, auth);

  return { podUrl: pod.pod.endsWith("/") ? pod.pod : `${pod.pod}/`, webId: pod.webId, credentials };
}

/**
 * Obtains a DPoP-bound access token using the client credentials grant.
 * 
 * If the server requests a DPoP nonce, the token request is repeated with
 * the supplied nonce.
 */
export async function getToken(baseUrl: string, credentials: Credentials, keys: DpopKeys): Promise<string> {
  const MAX_ATTEMPTS = 2;
  const discovery = await fetchJson<OidcDiscovery>(new URL(".well-known/openid-configuration", baseUrl));
  const basic = Buffer.from(
    `${encodeURIComponent(credentials.id)}:${encodeURIComponent(credentials.secret)}`, "utf8",
  ).toString("base64");
  
  let nonce: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        DPoP: await proof(keys, "POST", discovery.token_endpoint, { nonce }),
      },
      body: "grant_type=client_credentials&scope=webid",
    });

    const fresh = nextNonce(response, nonce);
    if (!response.ok && fresh && attempt === 0) {
      nonce = fresh;
      await response.text();
      continue;
    }
    if (!response.ok) throw new Error(`token: ${response.status} ${(await response.text()).slice(0, 200)}`);
    return (await response.json()).access_token;
  }
  throw new Error("unreachable");
}
