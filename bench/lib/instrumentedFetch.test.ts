/**
 * @packageDocumentation
 * Tests `instrumentFetch`: it counts one request per call, sums bytes sent
 * across every body type (string, binary, ArrayBuffer, Blob, and an
 * unmeasurable body that counts as 0 rather than NaN), reads bytes received
 * from `Content-Length`, leaves the response body readable, and zeroes every
 * counter on `reset()`.
 */

import { describe, it, expect } from "vitest";
import { instrumentFetch } from "./instrumentedFetch";

/** A stand-in inner fetch that echoes a body of the requested size. */
function fakeFetch(responseBytes = 0) {
  return async () =>
    new Response("x".repeat(responseBytes), {
      headers: responseBytes ? { "content-length": String(responseBytes) } : {},
    });
}

describe("instrumentFetch", () => {
  it("counts one request per call", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch());
    await fetch("https://pod.example/a");
    await fetch("https://pod.example/b");
    expect(metrics.requests).toBe(2);
  });

  it("sums bytes sent from a string body (UTF-8)", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch());
    await fetch("https://pod.example/a", { method: "PUT", body: "héllo" });
    expect(metrics.bytesSent).toBe(Buffer.byteLength("héllo", "utf8"));
  });

  it("sums bytes sent from a binary body", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch());
    await fetch("https://pod.example/a", { method: "PUT", body: new Uint8Array(10) });
    expect(metrics.bytesSent).toBe(10);
  });

  it("sums bytes sent from an ArrayBuffer body", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch());
    await fetch("https://pod.example/a", { method: "PUT", body: new ArrayBuffer(16) as unknown as Uint8Array });
    expect(metrics.bytesSent).toBe(16);
  });

  it("sums bytes sent from a Blob body", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch());
    await fetch("https://pod.example/a", { method: "PUT", body: new Blob(["abcde"]) as unknown as Uint8Array });
    expect(metrics.bytesSent).toBe(5);
  });

  it("counts an unmeasurable body as 0, never NaN", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch());
    await fetch("https://pod.example/a", { method: "PUT", body: {} as unknown as Uint8Array });
    expect(metrics.bytesSent).toBe(0);
    expect(Number.isNaN(metrics.bytesSent)).toBe(false);
  });

  it("reads bytes received from the Content-Length header", async () => {
    const { fetch, metrics } = instrumentFetch(fakeFetch(128));
    await fetch("https://pod.example/a");
    expect(metrics.bytesReceived).toBe(128);
  });

  it("returns the inner response unchanged (body still readable)", async () => {
    const { fetch } = instrumentFetch(fakeFetch(3));
    const response = await fetch("https://pod.example/a");
    expect(await response.text()).toBe("xxx");
  });

  it("reset() zeroes every counter", async () => {
    const { fetch, metrics, reset } = instrumentFetch(fakeFetch(5));
    await fetch("https://pod.example/a", { method: "PUT", body: "abc" });
    reset();
    expect(metrics).toEqual({ requests: 0, bytesSent: 0, bytesReceived: 0 });
  });
});
