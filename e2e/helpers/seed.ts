import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url));
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

export type PodIdentity = {
  webId: string;
  storageRoot: string;
  appContainer: string;
  catalogUri: string;
  inboxUri: string;
};

const CSS_BASE_URL = "http://localhost:3001/";
const TURTLE = "text/turtle";
const SPARQL_UPDATE = "application/sparql-update";
const N3_PATCH = "text/n3";

export function podOf(podName: string): PodIdentity {
  const storageRoot = `${CSS_BASE_URL}${podName}/`;
  return {
    webId: `${storageRoot}profile/card#me`,
    storageRoot,
    appContainer: `${storageRoot}my-solid-app/`,
    // Match resolveCatalogUri's fallback path so the app finds the catalog
    // without needing to read the dcat:catalog triple from the profile.
    catalogUri: `${storageRoot}catalog.ttl`,
    inboxUri: `${storageRoot}inbox/`,
  };
}

const EMPTY_CATALOG_TURTLE = `@prefix dcat: <http://www.w3.org/ns/dcat#> .
<> a dcat:Catalog .
`;

const SD_NAMESPACE = "https://w3id.org/solid-drive#";

/**
 * Maps a schema.org dataset class (used in the catalog's dcterms:conformsTo)
 * to the corresponding solid-drive file type used in the per-file index.ttl.
 */
function inferSolidDriveType(schemaClassUri: string): string {
  if (schemaClassUri.endsWith("ImageObject")) return `${SD_NAMESPACE}ImageFile`;
  if (schemaClassUri.endsWith("VideoObject")) return `${SD_NAMESPACE}VideoFile`;
  if (schemaClassUri.endsWith("AudioObject")) return `${SD_NAMESPACE}AudioFile`;
  if (schemaClassUri.endsWith("SpreadsheetDigitalDocument")) return `${SD_NAMESPACE}SpreadsheetDocument`;
  if (schemaClassUri.endsWith("TextDigitalDocument")) return `${SD_NAMESPACE}TextDocument`;
  return "http://schema.org/DigitalDocument";
}

async function listContainerChildren(authedFetch: typeof fetch, containerUri: string): Promise<string[]> {
  const response = await authedFetch(containerUri, { headers: { Accept: TURTLE } });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`GET ${containerUri} returned ${response.status}`);
  const text = await response.text();
  // Parse Turtle properly. A regex over `.` and `;` mis-terminates inside
  // URIs that contain dots (e.g. `<photo.png/>`).
  const quads = new Parser({ baseIRI: containerUri }).parse(text);
  const uris = new Set<string>();
  for (const quad of quads) {
    if (quad.predicate.value === LDP_CONTAINS) {
      uris.add(quad.object.value);
    }
  }
  return [...uris];
}

async function deleteRecursive(authedFetch: typeof fetch, uri: string): Promise<void> {
  if (uri.endsWith("/")) {
    const children = await listContainerChildren(authedFetch, uri);
    for (const child of children) {
      await deleteRecursive(authedFetch, child);
    }
  }
  // CSS rejects DELETE on a resource whose .acl still exists. Drop the
  // companion .acl first; ignore failures (most resources don't have one).
  await authedFetch(`${uri}.acl`, { method: "DELETE" }).catch(() => {});

  const response = await authedFetch(uri, { method: "DELETE" });
  if (!response.ok && response.status !== 404 && response.status !== 405) {
    const remaining = uri.endsWith("/")
      ? await listContainerChildren(authedFetch, uri).catch(() => [])
      : [];
    throw new Error(
      `DELETE ${uri} returned ${response.status}; remaining children: ${remaining.join(", ") || "(none)"}`,
    );
  }
}

/**
 * Wipes any leftover state from previous runs. Deletes every child of the
 * app container, every inbox message, and the catalog. The app container
 * and inbox themselves are left in place (CSS rejects DELETE on a
 * container once it's been ACL'd).
 */
export async function cleanPod(authedFetch: typeof fetch, pod: PodIdentity): Promise<void> {
  const appChildren = await listContainerChildren(authedFetch, pod.appContainer).catch(() => []);
  for (const child of appChildren) {
    await deleteRecursive(authedFetch, child);
  }
  const inboxChildren = await listContainerChildren(authedFetch, pod.inboxUri).catch(() => []);
  for (const message of inboxChildren) {
    await deleteRecursive(authedFetch, message);
  }
  await authedFetch(pod.catalogUri, { method: "DELETE" }).catch(() => {});
}

async function ensureCatalogExists(authedFetch: typeof fetch, catalogUri: string): Promise<void> {
  const head = await authedFetch(catalogUri, { method: "HEAD" });
  if (head.ok) return;
  const put = await authedFetch(catalogUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: EMPTY_CATALOG_TURTLE,
  });
  if (!put.ok) {
    throw new Error(`PUT ${catalogUri} returned ${put.status}`);
  }
}

/**
 * Uploads a binary file to a per-file container and registers it in the
 * owner's catalog using the same shape the React upload flow produces.
 */
export async function seedFile(args: {
  authedFetch: typeof fetch;
  pod: PodIdentity;
  fileName: string;
  classUri: string;
  mediaType: string;
  title: string;
  asset: string;
}): Promise<{ instanceUri: string; binaryUri: string; containerUri: string }> {
  const { authedFetch, pod, fileName, classUri, mediaType, title, asset } = args;
  const slug = encodeURIComponent(fileName);
  const containerUri = `${pod.appContainer}${slug}/`;
  const binaryUri = `${containerUri}${slug}`;
  const instanceUri = `${containerUri}index.ttl`;

  const body = readFileSync(join(HELPERS_DIR, "..", "fixtures", "assets", asset));

  const putResponse = await authedFetch(binaryUri, {
    method: "PUT",
    headers: { "Content-Type": mediaType },
    body,
  });
  if (!putResponse.ok) {
    throw new Error(`PUT ${binaryUri} returned ${putResponse.status}`);
  }

  // Mirror production layout: each file gets a per-file container with an
  // index.ttl carrying the dataset metadata using the CatalogEntrySh shape
  // (schema:name etc.). FileCard reads these fields via LDO.
  const sdType = inferSolidDriveType(classUri);
  const indexTtl = `@prefix schema: <http://schema.org/> .
@prefix sd: <https://w3id.org/solid-drive#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a <${sdType}> ;
  schema:name "${title.replace(/"/g, '\\"')}" ;
  schema:encodingFormat "${mediaType}" ;
  schema:contentSize "${body.byteLength}" ;
  schema:uploadDate "${new Date().toISOString()}"^^xsd:dateTime ;
  schema:publisher <${pod.webId}> .
`;
  const indexResponse = await authedFetch(instanceUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: indexTtl,
  });
  if (!indexResponse.ok) {
    throw new Error(`PUT ${instanceUri} returned ${indexResponse.status}`);
  }

  await ensureCatalogExists(authedFetch, pod.catalogUri);

  const distUri = `${instanceUri}#distribution`;
  const sparqlUpdate = `PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
  <${pod.catalogUri}> dcat:dataset <${instanceUri}> .
  <${instanceUri}> a dcat:Dataset ;
    dcterms:conformsTo <${classUri}> ;
    dcterms:title "${title.replace(/"/g, '\\"')}" ;
    dcterms:modified "${new Date().toISOString()}"^^xsd:dateTime ;
    dcterms:publisher <${pod.webId}> ;
    dcat:distribution <${distUri}> .
  <${distUri}> a dcat:Distribution ;
    dcat:accessURL <${binaryUri}> ;
    dcat:mediaType "${mediaType}" ;
    dcat:byteSize ${body.byteLength} .
}`;

  const patchResponse = await authedFetch(pod.catalogUri, {
    method: "PATCH",
    headers: { "Content-Type": SPARQL_UPDATE },
    body: sparqlUpdate,
  });
  if (!patchResponse.ok) {
    throw new Error(`PATCH ${pod.catalogUri} returned ${patchResponse.status} ${patchResponse.statusText}`);
  }

  return { instanceUri, binaryUri, containerUri };
}

async function discoverAclUri(authedFetch: typeof fetch, resourceUri: string): Promise<string> {
  const head = await authedFetch(resourceUri, { method: "HEAD" });
  if (!head.ok) throw new Error(`HEAD ${resourceUri} returned ${head.status}`);
  const link = head.headers.get("link") ?? "";
  const match = link.match(/<([^>]+)>;\s*rel="acl"/);
  if (!match) throw new Error(`No ACL link header for ${resourceUri}`);
  const aclUri = match[1];
  return aclUri.startsWith("http") ? aclUri : new URL(aclUri, resourceUri).href;
}

function buildAclTurtle(opts: {
  resourceUri: string;
  owner: string;
  reader: string;
  includeDefault: boolean;
}): string {
  const defaultLine = opts.includeDefault ? `  acl:default <${opts.resourceUri}>;\n` : "";
  return `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner> a acl:Authorization;
  acl:agent <${opts.owner}>;
  acl:accessTo <${opts.resourceUri}>;
${defaultLine}  acl:mode acl:Read, acl:Write, acl:Control .

<#read> a acl:Authorization;
  acl:agent <${opts.reader}>;
  acl:accessTo <${opts.resourceUri}>;
  acl:mode acl:Read .
`;
}

/**
 * Mirrors what `ensureDiscoveryAccess` does in production: grants the contact
 * read on the owner's main catalog and read on the app container.
 */
export async function grantDiscoveryAccess(
  authedFetch: typeof fetch,
  pod: PodIdentity,
  contactWebId: string,
): Promise<void> {
  const catalogAclUri = await discoverAclUri(authedFetch, pod.catalogUri);
  const catalogAcl = buildAclTurtle({
    resourceUri: pod.catalogUri,
    owner: pod.webId,
    reader: contactWebId,
    includeDefault: false,
  });
  const catalogResponse = await authedFetch(catalogAclUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: catalogAcl,
  });
  if (!catalogResponse.ok) {
    throw new Error(`PUT ${catalogAclUri} returned ${catalogResponse.status}`);
  }

  const appAclUri = await discoverAclUri(authedFetch, pod.appContainer);
  const appAcl = buildAclTurtle({
    resourceUri: pod.appContainer,
    owner: pod.webId,
    reader: contactWebId,
    includeDefault: true,
  });
  const appResponse = await authedFetch(appAclUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: appAcl,
  });
  if (!appResponse.ok) {
    throw new Error(`PUT ${appAclUri} returned ${appResponse.status}`);
  }
}

async function patchProfile(
  authedFetch: typeof fetch,
  profileDocUri: string,
  inserts: string,
): Promise<void> {
  const body = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix pim: <http://www.w3.org/ns/pim/space#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<> a solid:InsertDeletePatch;
  solid:inserts { ${inserts} } .`;
  const response = await authedFetch(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": N3_PATCH },
    body,
  });
  if (!response.ok) {
    throw new Error(`PATCH ${profileDocUri} returned ${response.status} ${response.statusText}`);
  }
}

async function ensureInbox(authedFetch: typeof fetch, pod: PodIdentity): Promise<void> {
  const head = await authedFetch(pod.inboxUri, { method: "HEAD" });
  if (!head.ok) {
    const put = await authedFetch(pod.inboxUri, {
      method: "PUT",
      headers: { "Content-Type": TURTLE },
      body: "",
    });
    if (!put.ok) throw new Error(`PUT ${pod.inboxUri} returned ${put.status}`);
  }

  // Open the inbox to public append + owner read so contacts can post requests.
  const aclUri = await discoverAclUri(authedFetch, pod.inboxUri);
  const acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#owner> a acl:Authorization;
  acl:agent <${pod.webId}>;
  acl:accessTo <${pod.inboxUri}>;
  acl:default <${pod.inboxUri}>;
  acl:mode acl:Read, acl:Write, acl:Control .

<#append> a acl:Authorization;
  acl:agentClass foaf:Agent;
  acl:accessTo <${pod.inboxUri}>;
  acl:default <${pod.inboxUri}>;
  acl:mode acl:Append .
`;
  const put = await authedFetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: acl,
  });
  if (!put.ok) throw new Error(`PUT ${aclUri} returned ${put.status}`);
}

/**
 * Ensures the WebID profile has `pim:storage` pointing at the pod root,
 * a `foaf:name`, an `ldp:inbox` link, and a `dcat:catalog` link. CSS-generated
 * profiles do not include these by default and the app's profile-driven UI
 * breaks without them.
 */
export async function ensureProfileBasics(
  authedFetch: typeof fetch,
  pod: PodIdentity,
  displayName: string,
): Promise<void> {
  await ensureInbox(authedFetch, pod);

  const profileDocUri = pod.webId.split("#")[0];
  await patchProfile(
    authedFetch,
    profileDocUri,
    `<#me> pim:storage <${pod.storageRoot}> ;
       foaf:name "${displayName}" ;
       <http://www.w3.org/ns/ldp#inbox> <${pod.inboxUri}> ;
       <http://www.w3.org/ns/dcat#catalog> <${pod.catalogUri}> .
     <> <http://www.w3.org/ns/dcat#catalog> <${pod.catalogUri}> .`,
  );
}

/**
 * Writes a per-file ACL granting `contactWebId` read access on the file's
 * per-file container (with acl:default so they can read children too). Mirrors
 * what `useAclManager.grant` does on the owner side.
 */
export async function shareFileWith(
  authedFetch: typeof fetch,
  pod: PodIdentity,
  contactWebId: string,
  fileContainerUri: string,
): Promise<void> {
  const aclUri = await discoverAclUri(authedFetch, fileContainerUri);
  const acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner> a acl:Authorization;
  acl:agent <${pod.webId}>;
  acl:accessTo <${fileContainerUri}>;
  acl:default <${fileContainerUri}>;
  acl:mode acl:Read, acl:Write, acl:Control .

<#read> a acl:Authorization;
  acl:agent <${contactWebId}>;
  acl:accessTo <${fileContainerUri}>;
  acl:default <${fileContainerUri}>;
  acl:mode acl:Read .
`;
  const response = await authedFetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: acl,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status}`);
  }
}

/**
 * Drops `contactWebId` from the file's ACL — the same WAC change the share
 * panel's Revoke action makes. The per-viewer shared catalog is left intact,
 * mirroring our useAclManager.revoke fix.
 */
export async function unshareFileWith(
  authedFetch: typeof fetch,
  pod: PodIdentity,
  fileContainerUri: string,
): Promise<void> {
  const aclUri = await discoverAclUri(authedFetch, fileContainerUri);
  const acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner> a acl:Authorization;
  acl:agent <${pod.webId}>;
  acl:accessTo <${fileContainerUri}>;
  acl:default <${fileContainerUri}>;
  acl:mode acl:Read, acl:Write, acl:Control .
`;
  const response = await authedFetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": TURTLE },
    body: acl,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status}`);
  }
}

/**
 * Adds `contactWebId` to `viewerWebId`'s profile via foaf:knows.
 */
export async function addContact(
  authedFetch: typeof fetch,
  viewerWebId: string,
  contactWebId: string,
): Promise<void> {
  const profileDocUri = viewerWebId.split("#")[0];
  await patchProfile(authedFetch, profileDocUri, `<#me> foaf:knows <${contactWebId}> .`);
}
