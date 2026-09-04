/**
 * @packageDocumentation
 * A fetch stub for the write-method equivalence tests. It answers GET with
 * an empty typed catalog and remembers the body of any PUT it receives, so a
 * test can run a real append against it and inspect what got written.
 */

import { RDF_NAMESPACES } from "@/config";

export interface CatalogFetchStub {
  fetch: (url: string, init?: { method?: string; body?: string }) => Promise<Response>;
  writtenBody: () => string;
}

/** Answers GET at `catalogUri` with an empty typed catalog, and remembers the body of any PUT. */
export function catalogFetchStub(catalogUri: string): CatalogFetchStub {
  let writtenBody = "";
  const seed = `@prefix dcat: <${RDF_NAMESPACES.DCAT}> .\n<${catalogUri}> a dcat:Catalog .\n`;
  const fetch = async (_url: string, init: { method?: string; body?: string } = {}) => {
    const method = init.method ?? "GET";
    if (method === "GET") return new Response(seed, { status: 200, headers: { "content-type": "text/turtle" } });
    if (method === "PUT") { writtenBody = init.body ?? ""; return new Response(null, { status: 205 }); }
    return new Response(null, { status: 200 });
  };
  return { fetch, writtenBody: () => writtenBody };
}
