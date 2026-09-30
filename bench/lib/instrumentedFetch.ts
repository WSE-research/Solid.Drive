/**
 * @packageDocumentation
 * Adds request and byte counting to an {@link AuthFetch}: 
 * 
 * how many requests an operation makes, and how many bytes it sends and receives. 
 * Using the number of requests, our prediction model can predict how long a
 * Solid operation takes more accurately than using the payload size. Therefore,
 * every delete/restore suite reports requests and bytes alongside latency
 * to explain the measured performance.
 *
 * Non-invasive: sent bytes are determined from the request body and received
 * bytes from the `Content-Length` header, so the response body remains
 * untouched and the measured operation runs without interference.
 */

import type { AuthFetch } from "./auth";

export interface FetchMetrics {
  requests: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface InstrumentedFetch {
  fetch: AuthFetch;
  metrics: FetchMetrics;
  reset: () => void;
}

/**
 * Request bodies may be strings, typed arrays, ArrayBuffers, or Blobs.
 * Bodies without a measurable size contribute 0 bytes to the total.
 */
function bodyLength(body: unknown): number {
  if (body === undefined || body === null) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  if (typeof (body as { byteLength?: unknown }).byteLength === "number") {
    return (body as { byteLength: number }).byteLength; 
  }
  if (typeof (body as { size?: unknown }).size === "number") {
    return (body as { size: number }).size; // Blob / File
  }
  return 0;
}

export function instrumentFetch(inner: AuthFetch): InstrumentedFetch {
  const metrics: FetchMetrics = { requests: 0, bytesSent: 0, bytesReceived: 0 };

  const fetch: AuthFetch = async (url, init = {}) => {
    metrics.requests += 1;
    metrics.bytesSent += bodyLength(init.body);
    const response = await inner(url, init);
    const contentLength = response.headers.get("content-length");
    if (contentLength) metrics.bytesReceived += Number(contentLength);
    return response;
  };

  const reset = (): void => {
    metrics.requests = 0;
    metrics.bytesSent = 0;
    metrics.bytesReceived = 0;
  };

  return { fetch, metrics, reset };
}
