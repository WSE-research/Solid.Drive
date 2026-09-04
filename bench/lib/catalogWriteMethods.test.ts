/**
 * @packageDocumentation
 * Holds `putAppend` to the app's own append. Both write the whole catalog back
 * with the same triples, so this checks {@link putAppend}'s PUT body carries
 * exactly the quads the shipped {@link appendToCatalog} writes. It is the
 * PUT-side twin of the `buildN3Patch` equivalence test.
 *
 * Why it earns its place: `putAppend` builds its body from `addEntryQuads`,
 * which can drift from the app with nothing to notice. It already had, dropping
 * `a sd:File`, until this test caught it.
 */

import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { putAppend } from "./catalogWriteMethods";
import { sortedQuadKeys } from "./quadKey";
import { catalogFetchStub } from "./catalogFetchStub";
import type { CatalogAppend } from "./buildN3Patch";
import { appendToCatalog } from "@/infrastructure/solid/catalog";
import type { AuthFetch } from "./auth";

const base: CatalogAppend = {
  catalogUri: "https://pod.example/catalog.ttl",
  instanceUri: "https://pod.example/photos/cat/",
  binaryUri: "https://pod.example/photos/cat/cat.png",
  classUri: "https://schema.org/ImageObject",
  mediaType: "image/png",
  byteSize: 2048,
  title: "Cat",
  description: "A cat photo",
  modified: "2026-08-25T10:00:00.000Z",
  publisherWebId: "https://pod.example/profile/card#me",
  parentUri: "https://pod.example/photos/",
};

const parsedKeys = (body: string, catalogUri: string): string[] =>
  sortedQuadKeys(new Parser({ baseIRI: catalogUri }).parse(body));

async function putAppendBody(entry: CatalogAppend): Promise<string> {
  const stub = catalogFetchStub(entry.catalogUri);
  await putAppend(stub.fetch as unknown as AuthFetch, entry.catalogUri, entry);
  return stub.writtenBody();
}

async function appAppendBody(entry: CatalogAppend): Promise<string> {
  const stub = catalogFetchStub(entry.catalogUri);
  await appendToCatalog({
    ...entry,
    parentUri: entry.parentUri ?? "",
    fetch: stub.fetch as unknown as Parameters<typeof appendToCatalog>[0]["fetch"],
  });
  return stub.writtenBody();
}

async function expectSameQuads(entry: CatalogAppend): Promise<void> {
  expect(parsedKeys(await putAppendBody(entry), entry.catalogUri))
    .toEqual(parsedKeys(await appAppendBody(entry), entry.catalogUri));
}

describe("putAppend <-> appendToCatalog equivalence", () => {
  it("writes exactly the quads the shipped appendToCatalog writes, with a parent", () =>
    expectSameQuads(base));

  it("stays equivalent with no parent and no description", () =>
    expectSameQuads({ ...base, parentUri: "", description: "" }));
});
