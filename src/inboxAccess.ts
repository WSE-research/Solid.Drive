import {
  buildAccessRejectionMessage,
  buildAccessRequestMessage,
  discoverInboxUriFromProfile,
  parseAccessRejectionMessage,
  parseAccessRequestMessage,
  parseContainedResourceUris,
} from "./inboxMessages";
import type { AccessRejection, AccessRequest } from "./inboxMessages";

export type { AccessRejection, AccessRequest, AccessRequestType } from "./inboxMessages";

export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

/**
 * Fetch the profile document for a WebID and extract its inbox URI
 */
export async function discoverInboxUri(webId: string, fetch: FetchFn): Promise<string> {
  const profileDocUri = webId.split("#")[0];
  const response = await fetch(profileDocUri, { headers: { Accept: "text/turtle" } });
  if (!response.ok) {
    throw new Error(`GET ${profileDocUri} returned ${response.status} ${response.statusText}`);
  }
  return discoverInboxUriFromProfile(profileDocUri, webId, await response.text());
}

/**
 * Post a Turtle message to an inbox
 */
async function postRequest(inboxUri: string, body: string, fetch: FetchFn): Promise<void> {
  const response = await fetch(inboxUri, {
    method: "POST",
    headers: { "Content-Type": "text/turtle" },
    body,
  });
  if (!response.ok) {
    throw new Error(`POST ${inboxUri} returned ${response.status} ${response.statusText}`);
  }
}

/**
 * Send a request for access to a contact's shared catalog
 */
export async function postCatalogAccessRequest(
  inboxUri: string,
  requesterWebId: string,
  contactWebId: string,
  fetch: FetchFn
): Promise<void> {
  await postRequest(inboxUri, buildAccessRequestMessage("catalog", requesterWebId, contactWebId), fetch);
}

/**
 * Send a request for access to a specific file container
 */
export async function postFileAccessRequest(
  inboxUri: string,
  requesterWebId: string,
  fileContainerUri: string,
  fetch: FetchFn
): Promise<void> {
  await postRequest(inboxUri, buildAccessRequestMessage("file", requesterWebId, fileContainerUri), fetch);
}

/**
 * Send a rejection notice to the requester's inbox
 */
export async function postRejectionNotification(
  requesterInboxUri: string,
  accessTo: string,
  fetch: FetchFn
): Promise<void> {
  await postRequest(requesterInboxUri, buildAccessRejectionMessage(accessTo), fetch);
}

/**
 * Return rejection messages found in an inbox
 */
export async function listRejectionNotifications(inboxUri: string, fetch: FetchFn): Promise<AccessRejection[]> {
  const indexResponse = await fetch(inboxUri, { headers: { Accept: "text/turtle" } });
  if (!indexResponse.ok) return [];
  const childUris = parseContainedResourceUris(inboxUri, await indexResponse.text());

  const rejections: AccessRejection[] = [];

  await Promise.all(
    childUris.map(async (messageUri) => {
      try {
        const response = await fetch(messageUri, { headers: { Accept: "text/turtle" } });
        if (!response.ok) return;
        const rejection = parseAccessRejectionMessage(messageUri, await response.text());
        if (rejection) rejections.push(rejection);
      } catch {
        // ignore unreadable messages
      }
    })
  );

  return rejections;
}

/**
 * Return access request messages found in an inbox
 */
export async function listAccessRequests(inboxUri: string, fetch: FetchFn): Promise<AccessRequest[]> {
  const indexResponse = await fetch(inboxUri, { headers: { Accept: "text/turtle" } });
  if (!indexResponse.ok) {
    if (indexResponse.status === 404) return [];
    throw new Error(`GET ${inboxUri} returned ${indexResponse.status} ${indexResponse.statusText}`);
  }
  const childUris = parseContainedResourceUris(inboxUri, await indexResponse.text());

  const requests: AccessRequest[] = [];

  await Promise.all(
    childUris.map(async (messageUri) => {
      try {
        const msgResponse = await fetch(messageUri, { headers: { Accept: "text/turtle" } });
        if (!msgResponse.ok) return;
        const request = parseAccessRequestMessage(messageUri, await msgResponse.text());
        if (request) requests.push(request);
      } catch {
        // Ignore unreadable messages
      }
    })
  );

  return requests;
}

/**
 * Delete a single inbox message by URI
 */
export async function deleteAccessRequest(messageUri: string, fetch: FetchFn): Promise<void> {
  const response = await fetch(messageUri, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE ${messageUri} returned ${response.status} ${response.statusText}`);
  }
}
