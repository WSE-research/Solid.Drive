/**
 * A small in-memory Solid server for generating the documents that the
 * soft-delete specification describes (docs/spec/) with Solid.Drive's own
 * code paths, instead of copying them by hand.
 *
 * It implements what those paths use: GET, HEAD, PUT, POST with `Slug`,
 * DELETE, and PATCH as N3 Patch (`text/n3`, `solid:inserts`/`solid:deletes`)
 * and as SPARQL Update (`INSERT DATA`/`DELETE DATA`, as LDO and
 * `linkCatalogToProfile` send it). Every resource has a strong entity tag,
 * and `If-Match`, `If-None-Match: *`, and `If-Unmodified-Since` are applied
 * as RFC 9110 describes. A PATCH creates a missing resource, as the
 * Community Solid Server does, and like it, a listing leaves out auxiliary
 * `.acl` resources, and deleting a resource deletes its `.acl`. With `n3Patch: false` the server neither
 * advertises nor accepts N3 Patch, like the PHP Solid Server, so the
 * clients take their conditional-PUT paths.
 */

import { DataFactory, Parser as N3Parser, Store as N3Store, Writer as N3Writer } from "n3";
import type { Quad } from "n3";
import type { FetchFn } from "@/types/solid";

const SOLID_TERMS = "http://www.w3.org/ns/solid/terms#";
const LDP = "http://www.w3.org/ns/ldp#";

interface StoredResource {
  body: string;
  contentType: string;
  version: number;
  modified: number;
}

/** Options of a {@link MemoryPod}. */
export interface MemoryPodOptions {
  /** The storage root, with a trailing slash. */
  root: string;
  /** Whether the server supports N3 Patch (`Accept-Patch: text/n3`). */
  n3Patch: boolean;
}

/** One stored RDF document, as {@link MemoryPod.turtleDocuments} returns it. */
export interface StoredDocument {
  url: string;
  body: string;
}

async function bodyText(body: BodyInit | null | undefined): Promise<string> {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
  if (typeof (body as Blob).text === "function") return (body as Blob).text();
  return String(body);
}

function parentOf(url: string): string {
  const trimmed = url.endsWith("/") ? url.slice(0, -1) : url;
  return trimmed.slice(0, trimmed.lastIndexOf("/") + 1);
}

function serialize(quads: Quad[]): string {
  return new N3Writer({ format: "N-Triples" }).quadsToString(quads);
}

/** Splits a SPARQL Update of the form LDO and Solid.Drive send into its data blocks. */
function sparqlDataBlocks(update: string): { inserts: string; deletes: string; prefixes: string } {
  const prefixes = [...update.matchAll(/PREFIX\s+([A-Za-z][\w-]*)?:\s*<([^>]*)>/gi)]
    .map((match) => `@prefix ${match[1] ?? ""}: <${match[2]}> .`)
    .join("\n");
  const block = (keyword: string): string => {
    const start = update.search(new RegExp(`${keyword}\\s+DATA\\s*\\{`, "i"));
    if (start < 0) return "";
    let index = update.indexOf("{", start) + 1;
    const from = index;
    let depth = 1;
    let quote: string | null = null;
    for (; index < update.length && depth > 0; index++) {
      const char = update[index];
      if (quote) {
        if (char === "\\") index++;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "<") index = update.indexOf(">", index);
      else if (char === "{") depth++;
      else if (char === "}") depth--;
    }
    return update.slice(from, index - 1);
  };
  return { inserts: block("INSERT"), deletes: block("DELETE"), prefixes };
}

/**
 * An in-memory Pod. See the file docs for what it implements.
 */
export class MemoryPod {
  private readonly resources = new Map<string, StoredResource>();
  private readonly containers = new Set<string>();
  private clock = Date.UTC(2026, 10, 1, 12, 0, 0);

  constructor(readonly options: MemoryPodOptions) {
    this.containers.add(options.root);
  }

  /** Puts a resource in place as another party would, without a request. */
  seed(url: string, body: string, contentType = "text/turtle"): void {
    this.store(url, body, contentType);
  }

  /** Every stored Turtle document, sorted by URL. */
  turtleDocuments(): StoredDocument[] {
    return [...this.resources.entries()]
      .filter(([, resource]) => resource.contentType.startsWith("text/turtle"))
      .map(([url, resource]) => ({ url, body: resource.body }))
      .sort((a, b) => a.url.localeCompare(b.url));
  }

  /** Every resource and container URL, sorted, for failure messages. */
  urls(): string[] {
    return [...this.resources.keys(), ...this.containers].sort();
  }

  /** Whether a resource or container exists. */
  has(url: string): boolean {
    return this.resources.has(url) || this.containers.has(url);
  }

  private etagOf(url: string): string {
    return `"v${this.resources.get(url)?.version ?? 0}"`;
  }

  private store(url: string, body: string, contentType: string): void {
    const version = (this.resources.get(url)?.version ?? 0) + 1;
    this.clock += 1000;
    this.resources.set(url, { body, contentType, version, modified: this.clock });
    for (let parent = parentOf(url); parent.startsWith(this.options.root); parent = parentOf(parent)) {
      this.containers.add(parent);
      if (parent === this.options.root) break;
    }
  }

  /** Direct children, without auxiliary `.acl` resources, which a listing does not show. */
  private children(containerUrl: string): string[] {
    return [...this.resources.keys(), ...this.containers]
      .filter((url) => url !== containerUrl && url.startsWith(containerUrl) && !url.endsWith(".acl"))
      .filter((url) => !url.slice(containerUrl.length).replace(/\/$/, "").includes("/"))
      .sort();
  }

  private preconditionFails(url: string, headers: Headers): boolean {
    const resource = this.resources.get(url);
    const exists = resource !== undefined || this.containers.has(url);
    const ifMatch = headers.get("If-Match");
    if (ifMatch !== null) {
      if (!resource) return true;
      if (ifMatch !== "*" && (ifMatch.startsWith("W/") || ifMatch !== this.etagOf(url))) return true;
    }
    if (headers.get("If-None-Match") === "*" && exists) return true;
    const ifUnmodifiedSince = headers.get("If-Unmodified-Since");
    if (ifMatch === null && ifUnmodifiedSince !== null && resource) {
      if (Math.floor(resource.modified / 1000) > Math.floor(Date.parse(ifUnmodifiedSince) / 1000)) return true;
    }
    return false;
  }

  private commonHeaders(url: string): Record<string, string> {
    const acceptPatch = this.options.n3Patch ? "text/n3, application/sparql-update" : "application/sparql-update";
    return {
      Link: `<${url}.acl>; rel="acl"`,
      "WAC-Allow": 'user="read write append control",public=""',
      "Accept-Patch": acceptPatch,
    };
  }

  readonly fetch: FetchFn = async (input, init) => {
    // Percent-encodes what a browser's fetch would (spaces, quotes, non-ASCII).
    const url = new URL(String(input)).href;
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    return this.handle(url, method, headers, init?.body);
  };

  private async handle(url: string, method: string, headers: Headers, body: BodyInit | null | undefined): Promise<Response> {
    if (!url.startsWith(this.options.root)) return new Response(null, { status: 404, statusText: "Not Found" });
    const resource = this.resources.get(url);

    if (method === "GET" || method === "HEAD") {
      if (this.containers.has(url)) {
        const listing = this.children(url).map((child) => `<${url}> <${LDP}contains> <${child}> .`).join("\n");
        return new Response(method === "HEAD" ? null : listing, {
          status: 200,
          headers: { ...this.commonHeaders(url), "Content-Type": "text/turtle" },
        });
      }
      if (!resource) return new Response(null, { status: 404, statusText: "Not Found", headers: this.commonHeaders(url) });
      return new Response(method === "HEAD" ? null : resource.body, {
        status: 200,
        headers: {
          ...this.commonHeaders(url),
          "Content-Type": resource.contentType,
          "Content-Length": String(new TextEncoder().encode(resource.body).length),
          ETag: this.etagOf(url),
          "Last-Modified": new Date(resource.modified).toUTCString(),
        },
      });
    }

    if (this.preconditionFails(url, headers)) return new Response(null, { status: 412, statusText: "Precondition Failed" });

    if (method === "PUT") {
      if (url.endsWith("/")) {
        if (this.containers.has(url)) return new Response(null, { status: 409, statusText: "Conflict" });
        this.containers.add(url);
        for (let parent = parentOf(url); parent.startsWith(this.options.root) && parent !== url; parent = parentOf(parent)) {
          this.containers.add(parent);
          if (parent === this.options.root) break;
        }
        return new Response(null, { status: 201, statusText: "Created" });
      }
      this.store(url, await bodyText(body), headers.get("Content-Type") ?? "application/octet-stream");
      return new Response(null, { status: resource ? 205 : 201 });
    }

    if (method === "POST") {
      if (!this.containers.has(url)) return new Response(null, { status: 404, statusText: "Not Found" });
      const slug = headers.get("Slug") ?? crypto.randomUUID();
      const isContainer = /BasicContainer|#Container/.test(headers.get("Link") ?? "");
      // LDO sends the slug percent-encoded; the server decodes it and encodes the name once.
      const name = encodeURIComponent(decodeURIComponent(slug.replace(/\/$/, "")));
      const target = `${url}${name}${isContainer ? "/" : ""}`;
      if (this.has(target)) return new Response(null, { status: 409, statusText: "Conflict" });
      if (isContainer) this.containers.add(target);
      else this.store(target, await bodyText(body), headers.get("Content-Type") ?? "application/octet-stream");
      return new Response(null, { status: 201, headers: { Location: target } });
    }

    if (method === "DELETE") {
      if (this.containers.has(url)) {
        if (this.children(url).length > 0) return new Response(null, { status: 409, statusText: "Conflict" });
        if (url === this.options.root) return new Response(null, { status: 405, statusText: "Method Not Allowed" });
        this.containers.delete(url);
        this.resources.delete(`${url}.acl`);
        return new Response(null, { status: 205 });
      }
      if (!resource) return new Response(null, { status: 404, statusText: "Not Found" });
      this.resources.delete(url);
      this.resources.delete(`${url}.acl`);
      return new Response(null, { status: 205 });
    }

    if (method === "PATCH") return this.patch(url, headers, await bodyText(body));

    return new Response(null, { status: 405, statusText: "Method Not Allowed" });
  }

  private patch(url: string, headers: Headers, text: string): Response {
    try {
      return this.applyPatch(url, headers, text);
    } catch {
      // A patch or document that does not parse, as a server reports it.
      return new Response(null, { status: 400, statusText: "Bad Request" });
    }
  }

  private applyPatch(url: string, headers: Headers, text: string): Response {
    const contentType = (headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
    let inserts: Quad[];
    let deletes: Quad[];
    if (contentType === "text/n3") {
      if (!this.options.n3Patch) return new Response(null, { status: 415, statusText: "Unsupported Media Type" });
      const patch = new N3Store(new N3Parser({ format: "text/n3", baseIRI: url }).parse(text));
      const formula = (predicate: string): Quad[] => {
        const graph = patch.getObjects(null, `${SOLID_TERMS}${predicate}`, null)[0];
        return graph ? patch.getQuads(null, null, null, graph) : [];
      };
      inserts = formula("inserts");
      deletes = formula("deletes");
    } else if (contentType === "application/sparql-update") {
      const { inserts: insertText, deletes: deleteText, prefixes } = sparqlDataBlocks(text);
      const parse = (block: string) => new N3Parser({ baseIRI: url }).parse(`${prefixes}\n${block}`);
      inserts = parse(insertText);
      deletes = parse(deleteText);
    } else {
      return new Response(null, { status: 415, statusText: "Unsupported Media Type" });
    }

    const existing = this.resources.get(url);
    const graph = new N3Store(existing ? new N3Parser({ baseIRI: url }).parse(existing.body) : []);
    const asDefaultGraph = (quads: Quad[]) => quads.map((q) => DataFactory.quad(q.subject, q.predicate, q.object));
    for (const quad of asDefaultGraph(deletes)) {
      if (graph.countQuads(quad.subject, quad.predicate, quad.object, null) === 0) {
        return new Response(null, { status: 409, statusText: "Conflict" });
      }
      graph.removeQuad(quad);
    }
    graph.addQuads(asDefaultGraph(inserts));
    this.store(url, serialize(graph.getQuads(null, null, null, null)), existing?.contentType ?? "text/turtle");
    return new Response(null, { status: existing ? 205 : 201 });
  }
}
