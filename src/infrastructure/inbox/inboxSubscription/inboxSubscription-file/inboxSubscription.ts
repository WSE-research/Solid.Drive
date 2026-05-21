/**
 * Solid Notifications Protocol WebSocket subscription for an inbox
 * resource. The client discovers the pod's notification subscription
 * endpoint, asks the server to open a `WebSocketChannel2023` for the
 * given topic, and listens on the returned WebSocket. Each notification
 * message triggers the consumer's callback so the UI can refresh in
 * real time.
 *
 * Reference: https://solid.github.io/notifications/protocol
 *
 * @packageDocumentation
 */

import { DataFactory, Parser } from "n3";
import {
  CONTENT_TYPES,
  RDF_NAMESPACES,
  SOLID_NOTIFICATION_CONTEXT_URL,
  SOLID_NOTIFICATION_WEBSOCKET_CHANNEL_TYPE,
  SOLID_STORAGE_DESCRIPTION_REL,
} from "@/config";
import type { FetchFn } from "@/types";

const { namedNode } = DataFactory;

const NOTIFY_SUBSCRIPTION = namedNode(`${RDF_NAMESPACES.NOTIFY}subscription`);
const NOTIFY_CHANNEL_TYPE = namedNode(`${RDF_NAMESPACES.NOTIFY}channelType`);
const WEB_SOCKET_CHANNEL_NODE = namedNode(SOLID_NOTIFICATION_WEBSOCKET_CHANNEL_TYPE);

/**
 * Handle returned by {@link subscribeToInbox}. Calling `close()` shuts
 * the WebSocket down and prevents further callbacks.
 *
 * @public
 */
export interface InboxSubscriptionHandle {
  close: () => void;
}

interface SubscriptionResponseBody {
  receiveFrom?: string;
}

/**
 * Parses an HTTP `Link` header and returns the first target URI for
 * the requested relation. Handles quoted and unquoted `rel` values.
 *
 * @internal
 */
export function parseLinkHeaderForRel(header: string, rel: string): string | null {
  const entries = header.split(",");
  for (const entry of entries) {
    const trimmed = entry.trim();
    const match = trimmed.match(/^<([^>]+)>\s*;\s*(.+)$/);
    if (!match) continue;
    const [, target, params] = match;
    const relMatch = params.match(/rel\s*=\s*"?([^";]+)"?/i);
    if (relMatch && relMatch[1].trim() === rel) {
      return target;
    }
  }
  return null;
}

async function discoverStorageDescription(resourceUri: string, fetch: FetchFn): Promise<string> {
  const response = await fetch(resourceUri, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`HEAD ${resourceUri} returned ${response.status} ${response.statusText}`);
  }
  const linkHeader = response.headers.get("Link");
  if (!linkHeader) {
    throw new Error(`No Link header on ${resourceUri}`);
  }
  const target = parseLinkHeaderForRel(linkHeader, SOLID_STORAGE_DESCRIPTION_REL);
  if (!target) {
    throw new Error(`Link header on ${resourceUri} has no storageDescription relation`);
  }
  return new URL(target, resourceUri).toString();
}

async function discoverWebSocketSubscriptionEndpoint(
  storageDescUri: string,
  fetch: FetchFn,
): Promise<string> {
  const response = await fetch(storageDescUri, {
    headers: { Accept: CONTENT_TYPES.TURTLE },
  });
  if (!response.ok) {
    throw new Error(`GET ${storageDescUri} returned ${response.status} ${response.statusText}`);
  }
  const turtle = await response.text();
  const parser = new Parser({ baseIRI: storageDescUri });
  const quads = parser.parse(turtle);

  const webSocketChannels = new Set<string>();
  for (const quad of quads) {
    if (
      quad.predicate.equals(NOTIFY_CHANNEL_TYPE) &&
      quad.object.equals(WEB_SOCKET_CHANNEL_NODE)
    ) {
      webSocketChannels.add(quad.subject.value);
    }
  }

  for (const quad of quads) {
    if (quad.predicate.equals(NOTIFY_SUBSCRIPTION) && webSocketChannels.has(quad.subject.value)) {
      return quad.object.value;
    }
  }

  throw new Error(`No WebSocketChannel2023 subscription endpoint in ${storageDescUri}`);
}

/**
 * Subscribes to change notifications for the given inbox resource.
 * Returns a handle that closes the WebSocket when the consumer
 * unmounts.
 *
 * @param inboxUri - LDP container that should be watched.
 * @param fetch - Authenticated Solid fetch.
 * @param onNotify - Called once per notification frame.
 * @param onError - Called when the WebSocket emits an error.
 *
 * @public
 */
export async function subscribeToInbox(
  inboxUri: string,
  fetch: FetchFn,
  onNotify: () => void,
  onError?: (error: unknown) => void,
): Promise<InboxSubscriptionHandle> {
  const storageDescUri = await discoverStorageDescription(inboxUri, fetch);
  const subscriptionEndpoint = await discoverWebSocketSubscriptionEndpoint(storageDescUri, fetch);

  const subscriptionResponse = await fetch(subscriptionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/ld+json" },
    body: JSON.stringify({
      "@context": [SOLID_NOTIFICATION_CONTEXT_URL],
      type: "WebSocketChannel2023",
      topic: inboxUri,
    }),
  });
  if (!subscriptionResponse.ok) {
    throw new Error(
      `Subscription to ${inboxUri} via ${subscriptionEndpoint} failed: ${subscriptionResponse.status} ${subscriptionResponse.statusText}`,
    );
  }
  const body = (await subscriptionResponse.json()) as SubscriptionResponseBody;
  if (!body.receiveFrom) {
    throw new Error(`Subscription response missing receiveFrom for ${inboxUri}`);
  }

  let closed = false;
  const socket = new WebSocket(body.receiveFrom);
  socket.addEventListener("message", () => {
    if (!closed) onNotify();
  });
  socket.addEventListener("error", (event) => {
    if (!closed) onError?.(event);
  });

  return {
    close() {
      closed = true;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    },
  };
}
