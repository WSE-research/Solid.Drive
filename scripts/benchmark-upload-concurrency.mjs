/**
 * Measures what bounded upload concurrency buys against a real Solid server.
 *
 * The bulk upload path does four network steps per file:
 *
 *   1. PUT  <dest>/<slug>/            create the per-file container
 *   2. PUT  <dest>/<slug>/<name>      the binary
 *   3. PUT  <dest>/<slug>/index.ttl   the metadata document
 *   4. PATCH <catalog>                append the DCAT entry
 *
 * Steps 1-3 touch only that file's own subtree and parallelise cleanly. Step 4
 * appends to one shared document and must not, so it runs under a mutex. This
 * script reproduces exactly that shape against a live Community Solid Server
 * and sweeps the pool size, which is the quantity `useUploadQueue` exposes as
 * `ENV.uploadConcurrency`.
 *
 * It deliberately does NOT drive the React hook: the hook adds shape validation
 * and LDO bookkeeping that are CPU-bound and identical at every concurrency, so
 * including them would dilute the effect being measured. What is measured is
 * the scheduling policy over the real protocol, including Solid-OIDC/DPoP,
 * which is where the time goes.
 *
 * Zero dependencies: Node >= 20 global fetch plus WebCrypto for the ES256 DPoP
 * proofs.
 *
 * Usage:
 *   node scripts/benchmark-upload-concurrency.mjs \
 *     [--base-url http://localhost:3000/solid-community-server/] \
 *     [--files 24] [--size-kb 64] [--levels 1,2,4,8,16] [--repeats 3]
 */

import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

/* -------------------------------------------------------------------------- */
/* args                                                                        */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const args = {
    baseUrl: "http://localhost:3000/solid-community-server/",
    files: 24,
    sizeKb: 64,
    levels: [1, 2, 4, 8, 16],
    repeats: 3,
    latencyMs: 0,
  };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === "--base-url") args.baseUrl = value;
    else if (flag === "--files") args.files = Number(value);
    else if (flag === "--size-kb") args.sizeKb = Number(value);
    else if (flag === "--levels") args.levels = value.split(",").map(Number);
    else if (flag === "--repeats") args.repeats = Number(value);
    else if (flag === "--latency-ms") args.latencyMs = Number(value);
    else if (flag) throw new Error(`unknown flag ${flag}`);
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));
const BASE = ARGS.baseUrl.endsWith("/") ? ARGS.baseUrl : `${ARGS.baseUrl}/`;

/* -------------------------------------------------------------------------- */
/* the pool under test -- same structure as services/transferPool              */
/* -------------------------------------------------------------------------- */

function createTransferPool(size) {
  const limit = Math.max(1, Math.floor(size));
  let active = 0;
  const waiting = [];
  const release = () => {
    active--;
    const next = waiting.shift();
    if (next) next();
  };
  const acquire = () =>
    active < limit
      ? ((active++), Promise.resolve())
      : new Promise((resolve) => waiting.push(() => { active++; resolve(); }));
  return {
    async run(task) {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* DPoP                                                                        */
/* -------------------------------------------------------------------------- */

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function createKeys() {
  const { publicKey, privateKey } = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  );
  const jwk = await subtle.exportKey("jwk", publicKey);
  return { privateKey, publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
}

async function proof(keys, method, url, { nonce, accessToken } = {}) {
  const htu = new URL(url);
  htu.search = "";
  htu.hash = "";
  const header = { alg: "ES256", typ: "dpop+jwt", jwk: keys.publicJwk };
  const payload = {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeAuthFetch(token, keys) {
  return async (url, { method = "GET", headers = {}, body } = {}) => {
    // Optional synthetic round-trip cost. Loopback has RTT ~= 0, and the
    // literature on Solid performance is emphatic that removing per-request
    // latency is exactly what makes request count stop predicting wall-clock
    // time -- so a localhost-only result systematically understates what
    // parallelism buys a real deployment. This is a labelled sensitivity knob,
    // not a claim about any particular network.
    if (ARGS.latencyMs > 0) await sleep(ARGS.latencyMs);
    let nonce;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, {
        method,
        headers: { ...headers, DPoP: await proof(keys, method, url, { nonce, accessToken: token }), Authorization: `DPoP ${token}` },
        body,
      });
      const fresh = response.headers.get("dpop-nonce");
      if ((response.status === 401 || response.status === 400) && fresh && fresh !== nonce && attempt === 0) {
        nonce = fresh;
        await response.text();
        continue;
      }
      return response;
    }
    throw new Error("unreachable");
  };
}

/* -------------------------------------------------------------------------- */
/* account provisioning                                                        */
/* -------------------------------------------------------------------------- */

async function json(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { accept: "application/json", ...(init.headers ?? {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url} -> ${response.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function provision(suffix) {
  const index = await json(new URL(".account/", BASE));
  const created = await json(index.controls.account.create, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  const auth = { authorization: `CSS-Account-Token ${created.authorization}` };
  const controls = (await json(new URL(".account/", BASE), { headers: auth })).controls;
  await json(controls.password.create, {
    method: "POST", headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ email: `bench-${suffix}@example.invalid`, password: `pw-${suffix}` }),
  });
  const pod = await json(controls.account.pod, {
    method: "POST", headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ name: `bench-${suffix}` }),
  });
  const credentials = await json(controls.account.clientCredentials, {
    method: "POST", headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ name: `bench-${suffix}`, webId: pod.webId }),
  });
  return { podUrl: pod.pod.endsWith("/") ? pod.pod : `${pod.pod}/`, webId: pod.webId, credentials };
}

async function getToken(credentials, keys) {
  const discovery = await json(new URL(".well-known/openid-configuration", BASE));
  const basic = Buffer.from(
    `${encodeURIComponent(credentials.id)}:${encodeURIComponent(credentials.secret)}`, "utf8",
  ).toString("base64");
  let nonce;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        DPoP: await proof(keys, "POST", discovery.token_endpoint, { nonce }),
      },
      body: "grant_type=client_credentials&scope=webid",
    });
    const fresh = response.headers.get("dpop-nonce");
    if (!response.ok && fresh && fresh !== nonce && attempt === 0) {
      nonce = fresh;
      await response.text();
      continue;
    }
    if (!response.ok) throw new Error(`token: ${response.status} ${(await response.text()).slice(0, 200)}`);
    return (await response.json()).access_token;
  }
  throw new Error("unreachable");
}

/* -------------------------------------------------------------------------- */
/* the workload                                                                */
/* -------------------------------------------------------------------------- */

const CATALOG_PREFIXES = `PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`;

/** One file: container, binary, index.ttl, then the catalog append under lock. */
async function uploadOne(authFetch, { destination, catalogUri, name, body, mutex }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const containerUri = `${destination}${slug}/`;

  let response = await authFetch(containerUri, {
    method: "PUT",
    headers: { "content-type": "text/turtle", link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' },
  });
  if (!response.ok) throw new Error(`container ${response.status}`);
  await response.text();

  const binaryUri = `${containerUri}${encodeURIComponent(name)}`;
  response = await authFetch(binaryUri, {
    method: "PUT", headers: { "content-type": "application/octet-stream" }, body,
  });
  if (!response.ok) throw new Error(`binary ${response.status}`);
  await response.text();

  const indexUri = `${containerUri}index.ttl`;
  response = await authFetch(indexUri, {
    method: "PUT",
    headers: { "content-type": "text/turtle" },
    body: `<#it> <http://purl.org/dc/terms/title> "${name}" ; <http://schema.org/contentSize> "${body.byteLength}" .`,
  });
  if (!response.ok) throw new Error(`index ${response.status}`);
  await response.text();

  await mutex.run(async () => {
    const update = `${CATALOG_PREFIXES}

INSERT DATA {
  <${catalogUri}> dcat:dataset <${indexUri}> .
  <${indexUri}> a dcat:Dataset ;
    dcterms:title "${name}" ;
    dcterms:modified "${new Date().toISOString()}"^^xsd:dateTime ;
    dcat:distribution <${indexUri}#distribution> .
  <${indexUri}#distribution> a dcat:Distribution ;
    dcat:accessURL <${binaryUri}> ;
    dcat:byteSize ${body.byteLength} .
}`;
    const patch = await authFetch(catalogUri, {
      method: "PATCH",
      headers: { "content-type": "application/sparql-update" },
      body: update,
    });
    if (!patch.ok) throw new Error(`catalog ${patch.status} ${(await patch.text()).slice(0, 200)}`);
    await patch.text();
  });
}

async function runOnce(authFetch, { podUrl, concurrency, files, payload, label }) {
  const destination = `${podUrl}${label}/`;
  const catalogUri = `${podUrl}${label}-catalog.ttl`;

  let response = await authFetch(destination, {
    method: "PUT",
    headers: { "content-type": "text/turtle", link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' },
  });
  await response.text();
  response = await authFetch(catalogUri, {
    method: "PUT",
    headers: { "content-type": "text/turtle" },
    body: `<${catalogUri}> a <http://www.w3.org/ns/dcat#Catalog> .`,
  });
  await response.text();

  const pool = createTransferPool(concurrency);
  const mutex = createTransferPool(1);

  const started = performance.now();
  await Promise.all(
    Array.from({ length: files }, (_, index) =>
      pool.run(() =>
        uploadOne(authFetch, {
          destination, catalogUri, name: `file-${index}.bin`, body: payload, mutex,
        }),
      ),
    ),
  );
  return performance.now() - started;
}

/* -------------------------------------------------------------------------- */

// Cryptographically random: the suffix also seeds the throwaway account's
// password, so a predictable value would let anyone else on the test server
// derive it.
const suffix = `${Date.now().toString(36)}${webcrypto.randomUUID().replaceAll("-", "")}`;
console.log(`base URL     ${BASE}`);
console.log(`workload     ${ARGS.files} files x ${ARGS.sizeKb} KiB, ${ARGS.repeats} repeats per level`);
console.log(`added latency ${ARGS.latencyMs} ms per request`);

const keys = await createKeys();
const account = await provision(suffix);
const token = await getToken(account.credentials, keys);
const authFetch = makeAuthFetch(token, keys);
const payload = new Uint8Array(ARGS.sizeKb * 1024).fill(65);

console.log(`pod          ${account.podUrl}\n`);

const results = [];
for (const concurrency of ARGS.levels) {
  const samples = [];
  for (let repeat = 0; repeat < ARGS.repeats; repeat++) {
    samples.push(
      await runOnce(authFetch, {
        podUrl: account.podUrl,
        concurrency,
        files: ARGS.files,
        payload,
        label: `c${concurrency}-r${repeat}`,
      }),
    );
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  results.push({ concurrency, median, min: samples[0], max: samples[samples.length - 1] });
  console.log(
    `concurrency ${String(concurrency).padStart(2)}  median ${median.toFixed(0).padStart(6)} ms` +
    `  (min ${samples[0].toFixed(0)}, max ${samples[samples.length - 1].toFixed(0)})`,
  );
}

const baseline = results.find((row) => row.concurrency === 1)?.median;
console.log(`\n| concurrency | median (ms) | min | max | speed-up vs 1 | files/s |`);
console.log(`| --- | --- | --- | --- | --- | --- |`);
for (const row of results) {
  const speedup = baseline ? (baseline / row.median).toFixed(2) : "n/a";
  const rate = (ARGS.files / (row.median / 1000)).toFixed(1);
  console.log(
    `| ${row.concurrency} | ${row.median.toFixed(0)} | ${row.min.toFixed(0)} | ${row.max.toFixed(0)} | ${speedup}x | ${rate} |`,
  );
}
