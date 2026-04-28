/**
 * @packageDocumentation
 * Functions for sending and reading inbox access requests.
 */

import {
  buildAccessRejectionMessage,
  buildAccessRequestMessage,
  discoverInboxUriFromProfile,
  parseAccessRejectionMessage,
  parseAccessRequestMessage,
  parseContainedResourceUris,
} from "../../inboxMessages";
import type { AccessRejection, AccessRequest } from "../../inboxMessages";
import type { FetchFn } from "@/types";
import { CONTENT_TYPES } from "@/config";

export type { AccessRejection, AccessRequest, AccessRequestType } from "../../inboxMessages";

/**
 * Fetches a profile and returns its ldp:inbox URI.
 *
 * @public
 */
export async function discoverInboxUri(webId: string, fetch: FetchFn): Promise<string> {
  const profileDocUri = webId.split("#")[0];
  const response = await fetch(profileDocUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
  if (!response.ok) {
    throw new Error(`GET ${profileDocUri} returned ${response.status} ${response.statusText}`);
  }
  return discoverInboxUriFromProfile(profileDocUri, webId, await response.text());
}

async function postRequest(inboxUri: string, body: string, fetch: FetchFn): Promise<void> {
  const response = await fetch(inboxUri, {
    method: "POST",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body,
  });
  if (!response.ok) {
    throw new Error(`POST ${inboxUri} returned ${response.status} ${response.statusText}`);
  }
}

/**
 * Sends a catalog access request to a contact's inbox.
 *
 * @public
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
 * Sends a file access request to a contact's inbox.
 *
 * @public
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
 * Sends a category-level access request to a contact's inbox, asking for
 * access to every file conforming to the given schema.org class.
 *
 * @public
 */
export async function postTypeAccessRequest(
  inboxUri: string,
  requesterWebId: string,
  classUri: string,
  fetch: FetchFn
): Promise<void> {
  await postRequest(inboxUri, buildAccessRequestMessage("type", requesterWebId, classUri), fetch);
}

/**
 * Sends a rejection notice to a requester's inbox.
 *
 * @public
 */
export async function postRejectionNotification(
  requesterInboxUri: string,
  accessTo: string,
  fetch: FetchFn
): Promise<void> {
  await postRequest(requesterInboxUri, buildAccessRejectionMessage(accessTo), fetch);
}

/**
 * Lists rejection messages in an inbox.
 *
 * @public
 */
export async function listRejectionNotifications(inboxUri: string, fetch: FetchFn): Promise<AccessRejection[]> {
  const indexResponse = await fetch(inboxUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
  if (!indexResponse.ok) return [];
  const childUris = parseContainedResourceUris(inboxUri, await indexResponse.text());

  const rejections: AccessRejection[] = [];

  await Promise.all(
    childUris.map(async (messageUri) => {
      try {
        const response = await fetch(messageUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
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
 * Lists access request messages in an inbox.
 *
 * @public
 */
export async function listAccessRequests(inboxUri: string, fetch: FetchFn): Promise<AccessRequest[]> {
  const indexResponse = await fetch(inboxUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
  if (!indexResponse.ok) {
    if (indexResponse.status === 404) return [];
    throw new Error(`GET ${inboxUri} returned ${indexResponse.status} ${indexResponse.statusText}`);
  }
  const childUris = parseContainedResourceUris(inboxUri, await indexResponse.text());

  const requests: AccessRequest[] = [];

  await Promise.all(
    childUris.map(async (messageUri) => {
      try {
        const msgResponse = await fetch(messageUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
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
 * Deletes an inbox message.
 *
 * @public
 */
export async function deleteAccessRequest(messageUri: string, fetch: FetchFn): Promise<void> {
  const response = await fetch(messageUri, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE ${messageUri} returned ${response.status} ${response.statusText}`);
  }
}
