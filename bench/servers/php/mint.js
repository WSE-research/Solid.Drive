// Obtains a login token for php-solid-server so that the benchmark can act as an
// authenticated user. CSS issues a token through a dedicated API, whereas
// php-solid-server does not, so this script completes the interactive login flow
// programmatically: it requests the login page, submits the username and
// password, approves the consent screen, and reads the token the server returns
// in the redirect.
//
// Three values are written to ~/php-seed.json: the token, the private key that
// signs requests, and the account's identity URL (its WebID). The benchmark
// scripts read the token from that file rather than repeating the login.
//
// CLIENT_ID must be a client already registered with the server, and
// ACCOUNT_USERNAME/ACCOUNT_PASSWORD a valid account on it.
//
// The two closing uploads confirm which authentication scheme the server
// accepts: the DPoP request is expected to fail and the plain Bearer request to
// succeed, which is why the benchmark authenticates with Bearer against this
// server.
const https = require("https");
const fs = require("fs");
const { webcrypto } = require("crypto");
const { subtle } = webcrypto;

const SERVER_ORIGIN = "https://localhost:8443";
const CLIENT_ID = "421aa90e079fa326b6494f812ad13e79";
const REDIRECT_URI = "http://localhost/cb";
const ACCOUNT_USERNAME = "peach";
const ACCOUNT_PASSWORD = "peach123";
const HTTPS_DEFAULT_PORT = 443;
const MAX_AUTHORIZE_STEPS = 12;
const LOG_PATH_PREVIEW_LENGTH = 50;
const LOG_LOCATION_PREVIEW_LENGTH = 60;
const LOG_RESPONSE_BODY_PREVIEW_LENGTH = 100;
const SEED_FILE_PATH = `${process.env.HOME}/php-seed.json`;

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sendRequest(method, url, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const request = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || HTTPS_DEFAULT_PORT,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
        // The server's certificate names the host IP, not localhost, so Node rejects
        // it here. For a local run only, add `rejectUnauthorized: false` to these
        // options. Never keep it enabled in committed code.
      },
      (response) => {
        let responseBody = "";
        response.on("data", (chunk) => (responseBody += chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: responseBody,
          }),
        );
      },
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function generateSigningKeyPair() {
  const keyPair = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await subtle.exportKey("jwk", keyPair.privateKey);
  const exportedPublicJwk = await subtle.exportKey("jwk", keyPair.publicKey);
  const publicJwk = {
    kty: exportedPublicJwk.kty,
    crv: exportedPublicJwk.crv,
    x: exportedPublicJwk.x,
    y: exportedPublicJwk.y,
  };
  return { privateKey: keyPair.privateKey, privateJwk, publicJwk };
}

async function createDpopProof(signingKeyPair, method, url, accessToken) {
  const targetUrl = new URL(url);
  targetUrl.search = "";
  targetUrl.hash = "";
  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: signingKeyPair.publicJwk,
  };
  const payload = {
    htu: targetUrl.toString(),
    htm: method,
    jti: webcrypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
  };
  if (accessToken) {
    const tokenHash = await subtle.digest("SHA-256", Buffer.from(accessToken));
    payload.ath = toBase64Url(new Uint8Array(tokenHash));
  }
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKeyPair.privateKey,
    Buffer.from(signingInput),
  );
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

function createCookieJar() {
  let cookie = "";
  return {
    header: () => cookie,
    store: (response) => {
      if (response.headers["set-cookie"]) {
        cookie = response.headers["set-cookie"]
          .map((entry) => entry.split(";")[0])
          .join("; ");
      }
    },
  };
}

function buildAuthorizeUrl() {
  const params = new URLSearchParams({
    response_type: "id_token token",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid webid",
    state: "s1",
    nonce: "n1",
  });
  return `${SERVER_ORIGIN}/authorize?${params.toString()}`;
}

function isFinalRedirect(location) {
  return (
    Boolean(location) &&
    (location.startsWith(REDIRECT_URI) || location.includes("#access_token"))
  );
}

function extractReturnUrl(pageBody) {
  const match = pageBody.match(/name="returnUrl" value="([^"]*)"/);
  return match ? match[1] : null;
}

function loginFormStep(url) {
  return {
    method: "POST",
    url,
    body: `username=${ACCOUNT_USERNAME}&password=${ACCOUNT_PASSWORD}`,
    contentType: "application/x-www-form-urlencoded",
  };
}

function approvalFormStep(url, returnUrl) {
  return {
    method: "POST",
    url,
    body: `approval=allow&returnUrl=${encodeURIComponent(returnUrl)}`,
    contentType: "application/x-www-form-urlencoded",
  };
}

function logAuthorizeStep(attempt, step, response) {
  console.log(
    attempt,
    step.method,
    step.url.replace(SERVER_ORIGIN, "").slice(0, LOG_PATH_PREVIEW_LENGTH),
    "->",
    response.status,
    (response.headers.location || "").slice(0, LOG_LOCATION_PREVIEW_LENGTH),
  );
}

async function runAuthorizeStep(signingKeyPair, cookieJar, step) {
  const headers = { Cookie: cookieJar.header() };
  if (step.method === "GET")
    headers.DPoP = await createDpopProof(signingKeyPair, "GET", step.url, null);
  if (step.contentType) {
    headers["Content-Type"] = step.contentType;
    headers["Content-Length"] = Buffer.byteLength(step.body);
  }
  const response = await sendRequest(step.method, step.url, {
    headers,
    body: step.body,
  });
  cookieJar.store(response);
  return response;
}

// Drives /authorize through the login page and the consent screen, returning the
// final redirect URL that carries the token, or null if the flow reaches a state
// this routine does not recognize.
async function walkAuthorizeFlow(signingKeyPair) {
  const cookieJar = createCookieJar();
  let step = {
    method: "GET",
    url: buildAuthorizeUrl(),
    body: null,
    contentType: null,
  };

  for (let attempt = 0; attempt < MAX_AUTHORIZE_STEPS; attempt++) {
    const response = await runAuthorizeStep(signingKeyPair, cookieJar, step);
    logAuthorizeStep(attempt, step, response);

    const location = response.headers.location;
    if (isFinalRedirect(location)) return location;

    if (location) {
      const nextUrl = new URL(location, SERVER_ORIGIN).toString();
      step = nextUrl.includes("/login/")
        ? loginFormStep(nextUrl)
        : { method: "GET", url: nextUrl, body: null, contentType: null };
      continue;
    }

    if (response.body.includes('name="approval"')) {
      step = approvalFormStep(step.url, extractReturnUrl(response.body));
      continue;
    }

    return null;
  }

  return null;
}

function extractAccessToken(redirectUrl) {
  if (!redirectUrl) return null;
  const fragment = redirectUrl.split("#")[1] || "";
  return new URLSearchParams(fragment).get("access_token");
}

async function testPutWithScheme(scheme, signingKeyPair, accessToken) {
  const url = `${SERVER_ORIGIN}/authtest-${scheme}-${Date.now()}.txt`;
  const headers = {
    Authorization: `${scheme} ${accessToken}`,
    "Content-Type": "text/plain",
    "Content-Length": 2,
  };
  if (scheme === "DPoP")
    headers.DPoP = await createDpopProof(
      signingKeyPair,
      "PUT",
      url,
      accessToken,
    );

  const response = await sendRequest("PUT", url, { headers, body: "hi" });
  console.log(
    `${scheme} PUT ->`,
    response.status,
    (response.body || "").slice(0, LOG_RESPONSE_BODY_PREVIEW_LENGTH),
  );
}

function saveSeed(accessToken, privateJwk) {
  const seed = {
    token: accessToken,
    privJwk: privateJwk,
    webid: `${SERVER_ORIGIN}/profile/card#me`,
  };
  fs.writeFileSync(SEED_FILE_PATH, JSON.stringify(seed, null, 2));
  console.log(`saved ${SEED_FILE_PATH}`);
}

(async () => {
  const signingKeyPair = await generateSigningKeyPair();
  const redirectUrl = await walkAuthorizeFlow(signingKeyPair);
  const accessToken = extractAccessToken(redirectUrl);
  if (!accessToken) {
    console.log("NO TOKEN, last:", redirectUrl);
    return;
  }

  await testPutWithScheme("DPoP", signingKeyPair, accessToken);
  await testPutWithScheme("Bearer", signingKeyPair, accessToken);
  saveSeed(accessToken, signingKeyPair.privateJwk);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
