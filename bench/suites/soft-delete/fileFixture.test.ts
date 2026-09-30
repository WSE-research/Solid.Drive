/**
 * @packageDocumentation
 * Tests the helper functions that build fake files for the soft-delete benchmarks:
 * their URLs, 
 * their binary content, 
 * their metadata, and the entry passed to the service under test.
 */

import { describe, it, expect } from "vitest";
import { fileLayout, sizedBinary, indexTurtle, sharedEntry, type FileDescriptor } from "./fileFixture";

const ROOT = "https://pod.example/w0/";

function descriptor(overrides: Partial<FileDescriptor> = {}): FileDescriptor {
  return {
    layout: fileLayout(ROOT, "abc"),
    webId: "https://pod.example/profile/card#me",
    byteSize: 4096,
    classUri: "https://schema.org/DigitalDocument",
    mediaType: "application/octet-stream",
    title: "bench-abc",
    modified: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("fileLayout", () => {
  it("composes the per-file container, binary and index URIs", () => {
    const layout = fileLayout(ROOT, "abc");
    expect(layout.containerUri).toBe(`${ROOT}files/abc/`);
    expect(layout.binaryUri).toBe(`${ROOT}files/abc/payload`);
    expect(layout.indexUri).toBe(`${ROOT}files/abc/index.ttl`);
  });

  it("keeps the binary distinct from the metadata doc", () => {
    const layout = fileLayout(ROOT, "abc");
    expect(layout.binaryUri).not.toBe(layout.indexUri);
  });
});

describe("sizedBinary", () => {
  it("returns a body of the requested byte length", () => {
    expect(sizedBinary(0).byteLength).toBe(0);
    expect(sizedBinary(65536).byteLength).toBe(65536);
  });
});

describe("indexTurtle", () => {
  it("embeds the descriptor's fields in valid-looking Turtle", () => {
    const turtle = indexTurtle(descriptor());
    expect(turtle).toContain("@prefix schema:");
    expect(turtle).toContain('schema:name "bench-abc"');
    expect(turtle).toContain('schema:contentSize "4096"');
    expect(turtle).toContain(`<${ROOT}files/abc/index.ttl>`);
  });
});

describe("sharedEntry", () => {
  it("builds a file entry whose binary and metadata point at different URLs", () => {
    const entry = sharedEntry(descriptor());
    expect(entry.metadataUri).toBe(`${ROOT}files/abc/index.ttl`);
    expect(entry.binaryUri).toBe(`${ROOT}files/abc/payload`);
    expect(entry.binaryUri).not.toBe(entry.metadataUri);
    expect(entry.byteSize).toBe(4096);
    expect(entry.mediaType).toBe("application/octet-stream");
    expect(entry.classUri).toBe("https://schema.org/DigitalDocument");
  });

  it("passes the description through", () => {
    expect(sharedEntry(descriptor(), "a note").description).toBe("a note");
    expect(sharedEntry(descriptor()).description).toBe("");
  });
});
