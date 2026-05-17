import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";
import { URLS } from "../config";

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url));
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

/** URI map for a CSS pod, derived from the pod owner's account name. */
export type PodIdentity = {
  /** The pod owner's WebID, e.g. `${storageRoot}profile/card#me`. */
  webId: string;
  /** Pod storage root, e.g. `http://localhost:3001/peach/`. */
  storageRoot: string;
  /** The app's working container, `${storageRoot}my-solid-app/`. */
  appContainer: string;
  /** Pod-level catalog, `${storageRoot}catalog.ttl`. */
  catalogUri: string;
  /** Pod inbox container, `${storageRoot}inbox/`. */
  inboxUri: string;
};

const TURTLE = "text/turtle";
const SPARQL_UPDATE = "application/sparql-update";
const N3_PATCH = "text/n3";

/**
 * Builds the URI map for a CSS pod from its account name. The catalog URI
 * uses `resolveCatalogUri`'s fallback path so the app finds it without
 * having to read the `dcat:catalog` triple from the profile first.
 *
 * @param podName - the pod's CSS account name, e.g. `"peach"` or `"parni"`
 * @returns the WebID, storage root, app container, catalog and inbox URIs
 */
export function podOf(podName: string): PodIdentity {
  const storageRoot = `${URLS.css}${podName}/`;
  return {
    webId: `${storageRoot}profile/card#me`,
    storageRoot,
    appContainer: `${storageRoot}my-solid-app/`,
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
 * app container, every inbox message, the catalog, and any stray pod-root
 * children left behind by tests that create resources outside `my-solid-app/`
 * (for example the OneDrive "New folder" test which creates folders at the
 * pod root). The durable root containers (`profile/`, `inbox/`, `my-solid-app/`)
 * are kept because CSS rejects DELETE on a container once it has been ACL'd.
 *
 * @param authedFetch - DPoP-bound fetch authenticated as the pod owner
 * @param pod - the pod whose state should be wiped
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

  // Wipe stray pod-root resources left by tests that create folders or files
  // outside the app container. The durable containers above are preserved;
  // the catalog was already deleted in the explicit DELETE above.
  const durableRootChildren = new Set<string>([
    `${pod.storageRoot}profile/`,
    pod.inboxUri,
    pod.appContainer,
  ]);
  const rootChildren = await listContainerChildren(authedFetch, pod.storageRoot).catch(() => []);
  for (const child of rootChildren) {
    if (durableRootChildren.has(child)) continue;
    if (child === pod.catalogUri) continue;
    await deleteRecursive(authedFetch, child);
  }
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

/** Arguments for {@link seedFile}. */
export type SeedFileArgs = {
  /** DPoP-bound fetch authenticated as the pod owner. */
  authedFetch: typeof fetch;
  /** Pod the file is uploaded into. */
  pod: PodIdentity;
  /** File name; used both for the container slug and for the binary resource name. */
  fileName: string;
  /** schema.org dataset class IRI; recorded in `dcterms:conformsTo`. */
  classUri: string;
  /** The binary's MIME type. */
  mediaType: string;
  /** Human-readable title; written to `schema:name` and `dcterms:title`. */
  title: string;
  /** Asset file name under `e2e/fixtures/assets/` used as the binary body. */
  asset: string;
};

/** URIs returned by {@link seedFile} for follow-up assertions or ACL work. */
export type SeededFile = {
  /** The per-file `index.ttl` carrying the dataset metadata. */
  instanceUri: string;
  /** The uploaded binary resource. */
  binaryUri: string;
  /** The per-file container holding the binary and `index.ttl`. */
  containerUri: string;
};

/**
 * Uploads a binary file to a per-file container and registers it in the
 * owner's catalog using the same shape the React upload flow produces.
 *
 * @param args - upload spec; see {@link SeedFileArgs} for each field
 * @returns the per-file `instanceUri`, `binaryUri`, and `containerUri`
 */
export async function seedFile(args: SeedFileArgs): Promise<SeededFile> {
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
 * read access on the owner's main catalog and read access on the app
 * container, so the contact can discover and browse files.
 *
 * @param authedFetch - DPoP-bound fetch authenticated as the pod owner
 * @param pod - the pod whose catalog and app container the contact gains read on
 * @param contactWebId - WebID of the contact being granted read access
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
 * breaks without them. Also creates the inbox and opens it to public append.
 *
 * @param authedFetch - DPoP-bound fetch authenticated as the pod owner
 * @param pod - the pod whose profile is being patched
 * @param displayName - human-readable name written to `foaf:name`
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
 * Writes a per-file ACL granting the contact read access on the file's
 * per-file container (with `acl:default` so they can read children too).
 * Mirrors what `useAclManager.grant` does on the owner side.
 *
 * @param authedFetch - DPoP-bound fetch authenticated as the pod owner
 * @param pod - the owner's pod, whose WebID is written as `acl:agent` for the owner rule
 * @param contactWebId - WebID of the contact being granted read access
 * @param fileContainerUri - per-file container URI to ACL, as returned by {@link seedFile}
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
 * Drops every non-owner grant from the file's ACL by writing an owner-only
 * ACL back, the same WAC change the share panel's Revoke action makes. The
 * per-viewer shared catalog is left intact so the file stays discoverable
 * as browsable instead of disappearing, mirroring `useAclManager.revoke`.
 *
 * @param authedFetch - DPoP-bound fetch authenticated as the pod owner
 * @param pod - the owner's pod, whose WebID is written as `acl:agent` for the owner rule
 * @param fileContainerUri - per-file container URI whose ACL is being rewritten
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
 * Adds the contact to the viewer's profile via `foaf:knows`, so the viewer's
 * Contacts list picks them up the same way `addContact` does in production.
 *
 * @param authedFetch - DPoP-bound fetch authenticated as the viewer
 * @param viewerWebId - WebID of the viewer whose profile is being patched
 * @param contactWebId - WebID being added as a contact
 */
export async function addContact(
  authedFetch: typeof fetch,
  viewerWebId: string,
  contactWebId: string,
): Promise<void> {
  const profileDocUri = viewerWebId.split("#")[0];
  await patchProfile(authedFetch, profileDocUri, `<#me> foaf:knows <${contactWebId}> .`);
}
