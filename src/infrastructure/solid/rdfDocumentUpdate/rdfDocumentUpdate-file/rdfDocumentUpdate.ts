/**
 * @packageDocumentation
 * Read-modify-write of a whole RDF document that does not lose concurrent
 * changes made by other clients.
 *
 * @remarks
 * The document is read, the caller's mutation runs on an N3 store, and
 * the difference between the store before and after is written back:
 *
 * - When the server advertises N3 Patch (`Accept-Patch: text/n3`) and the
 *   document parsed cleanly, only that difference is sent, as a
 *   `solid:InsertDeletePatch`. The server applies it atomically, so rows
 *   written or removed by others in the meantime stay as they are. A 409
 *   (a statement to delete is already gone) re-reads and retries.
 * - Otherwise (no N3 Patch, such as the PHP Solid Server; a 405, 415, or
 *   501 answer to the patch; or a damaged document that the next write
 *   should heal), the whole document is PUT with `If-Match: <ETag>`, or
 *   with `If-None-Match: *` when it did not exist yet. On 412 the document
 *   is read again, the mutation is applied again, and the write is
 *   retried, up to a bounded number of attempts.
 *
 * Residual risk: a server that sends no strong ETag for an existing
 * document gets an unconditional PUT, as before, because `If-Match`
 * compares strongly (RFC 9110) and there is nothing else to condition on.
 */

import { Store as N3Store, Writer as N3Writer } from "n3";
import type { Quad } from "n3";
import type { FetchFn } from "@/types";
import { CONTENT_TYPES, RDF_NAMESPACES } from "@/config";

/** Attempts before {@link updateRdfDocument} gives up on a document that keeps changing. */
export const DEFAULT_MAX_UPDATE_ATTEMPTS = 8;

/** Answers to a PATCH that mean "this server can't apply this patch format". */
const PATCH_UNSUPPORTED_STATUSES = new Set([405, 415, 501]);

/**
 * True when a PATCH response says the server doesn't support the patch
 * format, so the caller should fall back to a conditional PUT.
 *
 * @public
 */
export function isPatchUnsupported(status: number): boolean {
  return PATCH_UNSUPPORTED_STATUSES.has(status);
}

/**
 * A parsed document. `damaged` marks a partial parse: the quads are a real
 * prefix of the content, and the next write should replace the document
 * in full to drop the unparseable tail.
 *
 * @public
 */
export interface ParsedRdfDocument {
  quads: Quad[];
  damaged: boolean;
}

/**
 * Changes the document in place. Returning false cancels the write.
 * May run more than once when a concurrent write forces a retry, each
 * time against the freshly read document.
 *
 * @public
 */
export type RdfDocumentMutation = (store: N3Store, context: { exists: boolean }) => void | false | Promise<void | false>;

/**
 * Options for {@link updateRdfDocument}.
 *
 * @public
 */
export interface UpdateRdfDocumentOptions {
  /** Parses the document's Turtle. Throws when nothing can be recovered. */
  parse: (text: string, documentUri: string) => ParsedRdfDocument;
  /** Serializes the full document for the PUT path. */
  serialize: (quads: Quad[]) => string;
  /** Defaults to {@link DEFAULT_MAX_UPDATE_ATTEMPTS}. */
  maxAttempts?: number;
}

type AttemptOutcome = "done" | "conflict";

function header(response: Response, name: string): string | null {
  // Some callers' test doubles return bare objects without headers.
  return response.headers?.get?.(name) ?? null;
}

function acceptsN3Patch(response: Response): boolean {
  const acceptPatch = header(response, "Accept-Patch") ?? "";
  return acceptPatch.split(",").some((type) => type.trim().split(";")[0].toLowerCase() === CONTENT_TYPES.N3);
}

function isStrongEtag(etag: string | null): etag is string {
  return !!etag && !etag.startsWith("W/");
}

function toNTriples(quads: Quad[]): string {
  return new N3Writer({ format: "N-Triples" }).quadsToString(quads);
}

function buildInsertDeletePatch(inserts: Quad[], deletes: Quad[]): string {
  const clauses: string[] = [];
  if (deletes.length > 0) clauses.push(`solid:deletes {\n${toNTriples(deletes)}}`);
  if (inserts.length > 0) clauses.push(`solid:inserts {\n${toNTriples(inserts)}}`);
  return `@prefix solid: <${RDF_NAMESPACES.SOLID_TERMS}> .\n\n_:patch a solid:InsertDeletePatch ;\n  ${clauses.join(" ;\n  ")} .\n`;
}

function difference(from: N3Store, without: N3Store): Quad[] {
  return from
    .getQuads(null, null, null, null)
    .filter((q) => without.countQuads(q.subject, q.predicate, q.object, q.graph) === 0);
}

function backoff(attempt: number): Promise<void> {
  const delayMs = Math.floor(Math.random() * 20 * attempt);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function attemptUpdate(
  documentUri: string,
  fetch: FetchFn,
  mutate: RdfDocumentMutation,
  options: UpdateRdfDocumentOptions,
): Promise<AttemptOutcome> {
  const getResponse = await fetch(documentUri, { cache: "no-store" });
  if (!getResponse.ok && getResponse.status !== 404) {
    throw new Error(`Failed to read ${documentUri}: ${getResponse.status} ${getResponse.statusText}`);
  }
  const exists = getResponse.status !== 404;
  const parsed = exists ? options.parse(await getResponse.text(), documentUri) : { quads: [], damaged: false };

  const before = new N3Store(parsed.quads);
  const store = new N3Store(parsed.quads);
  if ((await mutate(store, { exists })) === false) return "done";

  if (exists && !parsed.damaged && acceptsN3Patch(getResponse)) {
    const inserts = difference(store, before);
    const deletes = difference(before, store);
    if (inserts.length === 0 && deletes.length === 0) return "done";
    const patchResponse = await fetch(documentUri, {
      method: "PATCH",
      headers: { "Content-Type": CONTENT_TYPES.N3 },
      body: buildInsertDeletePatch(inserts, deletes),
    });
    if (patchResponse.ok) return "done";
    if (patchResponse.status === 409) return "conflict";
    if (!isPatchUnsupported(patchResponse.status)) {
      throw new Error(`Failed to patch ${documentUri}: ${patchResponse.status} ${patchResponse.statusText}`);
    }
  }

  const headers: Record<string, string> = { "Content-Type": CONTENT_TYPES.TURTLE };
  const etag = header(getResponse, "ETag");
  if (!exists) headers["If-None-Match"] = "*";
  else if (isStrongEtag(etag)) headers["If-Match"] = etag;
  const putResponse = await fetch(documentUri, {
    method: "PUT",
    headers,
    body: options.serialize(store.getQuads(null, null, null, null)),
  });
  if (putResponse.ok) return "done";
  if (putResponse.status === 412) return "conflict";
  throw new Error(`Failed to write ${documentUri}: ${putResponse.status} ${putResponse.statusText}`);
}

/**
 * Applies `mutate` to the RDF document at `documentUri` without losing
 * concurrent writes by other clients. See the file docs for the patch
 * path, the conditional-PUT fallback, and the retry bound.
 *
 * @throws Error if the read or write fails, or the document kept changing
 * for every one of the allowed attempts.
 *
 * @public
 */
export async function updateRdfDocument(
  documentUri: string,
  fetch: FetchFn,
  mutate: RdfDocumentMutation,
  options: UpdateRdfDocumentOptions,
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_UPDATE_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await backoff(attempt);
    if ((await attemptUpdate(documentUri, fetch, mutate, options)) === "done") return;
  }
  throw new Error(`${documentUri} kept changing during ${maxAttempts} attempts to update it, so the change was not written`);
}
