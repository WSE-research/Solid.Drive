/**
 * Produces the documents of the soft-delete specification (docs/spec/) with
 * Solid.Drive's own code: the upload and create-folder hooks (through the
 * real LDO library), the catalog functions, and the soft-delete, restore,
 * and purge services, run against an in-memory Pod. Nothing here writes a
 * document itself; it only supplies inputs, a fixed clock, and fixed
 * UUIDs, so the output is the same on every run.
 *
 * The test that calls this mocks `@ldo/solid-react` with
 * {@link solidReactStub} (see ldoBinding.ts).
 */

import { act, renderHook } from "@testing-library/react";
import { Parser as N3Parser, Writer as N3Writer } from "n3";
import { vi } from "vitest";
import type { SolidContainer } from "@ldo/connected-solid";
import { ensureCatalogRootEntry, parseCatalog } from "@/infrastructure/solid/catalog";
import { getTrashCatalogUri } from "@/infrastructure/solid/trashPaths";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { useFileUpload } from "@/features/file-explorer/hooks/useFileUpload";
import { useCreateFolder } from "@/features/file-explorer/hooks/useCreateFolder";
import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import { softDeleteFolder } from "@/features/file-explorer/services/softDeleteFolder";
import { restoreTrashedFile } from "@/features/file-explorer/services/restoreTrashedFile";
import { restoreTrashedFolder } from "@/features/file-explorer/services/restoreTrashedFolder";
import { deleteResource } from "@/features/file-explorer/services/deleteResource";
import type { CatalogEntry } from "@/types/catalog";
import type { SharedEntry } from "@/types/sharing";
import { bindLdo } from "./ldoBinding";
import { MemoryPod } from "./memoryPod";

/** The Pod the scenario runs on. */
export const ROOT = "https://pod.example/alice/";
export const WEB_ID = `${ROOT}profile/card#me`;
export const CATALOG = `${ROOT}catalog.ttl`;
export const TRASH_CATALOG = getTrashCatalogUri(ROOT);

/** The name of the first upload holds a quote and non-ASCII letters, like the Solid.Sync golden fixtures. */
export const REPORT_NAME = 'Bericht "final" für Zoë.pdf';

/** Trash entry IDs, passed to the services as `uniqueSuffix`. */
export const TRASH_IDS = {
  notes: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  projects: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  report: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
} as const;

/**
 * The graph of a document as sorted N-Triples, so that a server that
 * re-serializes a document does not make it count as a new state. Blank
 * node labels change with every parse, which would make equal graphs look
 * different, so a document with a blank node is refused: none of the
 * documents of the specification has one.
 *
 * @throws Error when the document is not Turtle or holds a blank node.
 */
export function canonical(url: string, body: string): string {
  const quads = new N3Parser({ baseIRI: url }).parse(body);
  if (quads.some((q) => q.subject.termType === "BlankNode" || q.object.termType === "BlankNode")) {
    throw new Error(`${url} holds a blank node, so its graph cannot be compared by its N-Triples`);
  }
  return new N3Writer({ format: "N-Triples" }).quadsToString(quads).split("\n").filter(Boolean).sort().join("\n");
}

/** One state of one Turtle document, after the step that first produced it. */
export interface GeneratedDocument {
  step: string;
  url: string;
  body: string;
}

/** Result of {@link generateDocuments}. */
export interface GeneratedScenario {
  /** Every distinct state of every Turtle document, in the order the steps produced them. */
  documents: GeneratedDocument[];
  /** The Pod after the last step. */
  pod: MemoryPod;
}

const START = Date.UTC(2026, 10, 1, 12, 0, 0);
const MINUTE = 60 * 1000;

/** Fixed, valid version-4 UUIDs for entry tags, in the order they are minted. */
function fixedUuids(): () => `${string}-${string}-${string}-${string}-${string}` {
  let next = 0;
  return () => {
    next += 1;
    return `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  };
}

/** Mirrors `buildSharedEntry` in OneDriveLayout, which the file view passes to `softDeleteFile`. */
function sharedEntryFromRow(containerUri: string, entry: CatalogEntry): SharedEntry {
  return {
    metadataUri: `${containerUri}index.ttl`,
    binaryUri: entry.accessURL,
    classUri: entry.conformsTo,
    mediaType: entry.mediaType,
    byteSize: entry.byteSize,
    title: entry.title,
    description: entry.description,
    modified: entry.modified,
    parentUri: entry.parentUri ?? "",
  };
}

/** Mirrors `toSharedEntry` in useTrashEntries, which the Recycle Bin passes to `restoreTrashedFile`. */
function sharedEntryFromTrashRow(row: CatalogEntry): SharedEntry {
  return {
    metadataUri: row.uri,
    binaryUri: row.accessURL,
    classUri: row.conformsTo,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    title: row.title,
    description: row.description,
    modified: row.modified,
  };
}

async function readCatalog(pod: MemoryPod, catalogUri: string): Promise<CatalogEntry[]> {
  const response = await pod.fetch(catalogUri);
  return parseCatalog(await response.text(), catalogUri);
}

async function rowFor(pod: MemoryPod, catalogUri: string, uri: string): Promise<CatalogEntry> {
  const entries = await readCatalog(pod, catalogUri);
  const row = entries.find((entry) => entry.uri === uri);
  if (!row) throw new Error(`No row for ${uri} in ${catalogUri}`);
  return row;
}

function expectOk(label: string, result: { ok: boolean }): void {
  if (!result.ok) throw new Error(`${label} failed: ${JSON.stringify(result)}`);
}

/**
 * Runs the scenario: create two folders, upload five files, soft-delete
 * two files and a folder, restore one file and the folder, and purge the
 * other file. See the file docs.
 *
 * @param n3Patch - Whether the Pod supports N3 Patch, like the Community
 * Solid Server, or not, like the PHP Solid Server.
 */
export async function generateDocuments(n3Patch: boolean): Promise<GeneratedScenario> {
  const pod = new MemoryPod({ root: ROOT, n3Patch });
  pod.seed(`${ROOT}profile/card`, `<#me> a <http://xmlns.com/foaf/0.1/Person> .\n`);
  const dataset = bindLdo(WEB_ID, pod.fetch);
  const container = (uri: string) => dataset.getResource(uri) as SolidContainer;

  const documents: GeneratedDocument[] = [];
  const seen = new Set<string>();
  const snapshot = (step: string) => {
    for (const { url, body } of pod.turtleDocuments()) {
      if (url.endsWith(".acl")) continue;
      const key = `${url}\n${canonical(url, body)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push({ step, url, body });
    }
  };

  let minute = 0;
  const step = async (label: string, run: () => Promise<void>) => {
    vi.setSystemTime(START + minute * MINUTE);
    minute += 1;
    try {
      await run();
    } catch (error) {
      throw new Error(`Step "${label}" failed; the Pod holds:\n${pod.urls().join("\n")}`, { cause: error });
    }
    snapshot(label);
  };

  vi.useFakeTimers({ toFake: ["Date"] });
  const randomUuid = vi.spyOn(crypto, "randomUUID").mockImplementation(fixedUuids());
  // LDO logs the result of every commit.
  const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const seededAcl = () => `@prefix acl: <http://www.w3.org/ns/auth/acl#> .
<#owner> a acl:Authorization ; acl:agent <${WEB_ID}> ; acl:accessTo <./> ; acl:default <./> ; acl:mode acl:Read, acl:Write, acl:Control .
<#bob> a acl:Authorization ; acl:agent <https://bob.example/profile/card#me> ; acl:accessTo <./> ; acl:default <./> ; acl:mode acl:Read .
`;

  try {
    const { result: folders } = renderHook(() => useCreateFolder());
    const { result: uploads } = renderHook(() => useFileUpload());
    const createFolder = async (parent: string, folderName: string) => {
      let uri = "";
      await act(async () => {
        uri = await folders.current.createFolder({ parentContainer: container(parent), folderName, catalogUri: CATALOG, profileHasCatalog: true });
      });
      return uri;
    };
    const upload = async (parent: string, name: string, type: string, content: string) => {
      await act(async () => {
        await uploads.current.upload({
          file: new File([content], name, { type }),
          title: "",
          description: "",
          mainContainer: container(parent),
          catalogUri: CATALOG,
          profileHasCatalog: true,
        });
      });
    };

    await step("ensure the catalog's storage-root row", async () => {
      await ensureCatalogRootEntry({ catalogUri: CATALOG, storageRootUri: ROOT, publisherWebId: WEB_ID, fetch: pod.fetch });
    });

    let projects = "";
    let drafts = "";
    await step("create folder Projects", async () => {
      projects = await createFolder(ROOT, "Projects");
    });
    await step("create folder Projects/Drafts", async () => {
      drafts = await createFolder(projects, "Drafts");
    });
    await step(`upload ${REPORT_NAME}`, () => upload(ROOT, REPORT_NAME, "application/pdf", "%PDF-1.7 report"));
    await step("upload notes.txt", () => upload(ROOT, "notes.txt", "text/plain", "some notes"));
    await step("upload Projects/photo.png", () => upload(projects, "photo.png", "image/png", "PNG photo"));
    await step("upload Projects/Drafts/draft.txt", () => upload(drafts, "draft.txt", "text/plain", "a draft"));
    // A browser reports an empty type for a file it does not recognize.
    await step("upload data.bin (no media type)", () => upload(ROOT, "data.bin", "", "binary"));

    const notesContainer = `${ROOT}notes.txt/`;
    const reportContainer = `${ROOT}bericht-final-f-r-zo-.pdf/`;
    // Another app shared the notes with Bob, so their trash entry gets an access-rule snapshot.
    pod.seed(`${notesContainer}.acl`, seededAcl());

    const softDelete = async (containerUri: string, uniqueSuffix: string) => {
      const row = await rowFor(pod, CATALOG, `${containerUri}index.ttl`);
      expectOk("softDeleteFile", await softDeleteFile({
        containerUri, storageRootUri: ROOT, catalogUri: CATALOG,
        entry: sharedEntryFromRow(containerUri, row), ownerWebId: WEB_ID, fetch: pod.fetch,
        now: new Date(), uniqueSuffix,
      }));
    };
    await step("soft-delete notes.txt", () => softDelete(notesContainer, TRASH_IDS.notes));
    await step("soft-delete folder Projects", async () => {
      expectOk("softDeleteFolder", await softDeleteFolder({
        containerUri: projects, storageRootUri: ROOT, catalogUri: CATALOG, ownerWebId: WEB_ID, fetch: pod.fetch,
        now: new Date(), uniqueSuffix: TRASH_IDS.projects,
      }));
    });
    await step(`soft-delete ${REPORT_NAME}`, () => softDelete(reportContainer, TRASH_IDS.report));

    const trashEntry = (id: string) => `${ROOT}trash/${id}/`;
    await step("restore notes.txt", async () => {
      const row = await rowFor(pod, TRASH_CATALOG, `${trashEntry(TRASH_IDS.notes)}index.ttl`);
      expectOk("restoreTrashedFile", await restoreTrashedFile({
        trashItemContainerUri: toContainerUri(row.uri), storageRootUri: ROOT,
        entry: sharedEntryFromTrashRow(row), ownerWebId: WEB_ID, fetch: pod.fetch,
      }));
    });
    await step("restore folder Projects", async () => {
      const row = await rowFor(pod, TRASH_CATALOG, trashEntry(TRASH_IDS.projects));
      expectOk("restoreTrashedFolder", await restoreTrashedFolder({
        trashItemContainerUri: toContainerUri(row.uri), storageRootUri: ROOT, ownerWebId: WEB_ID,
        fetch: pod.fetch, trashedModified: row.modified,
      }));
    });
    // A restore of this name would fail (Solid.Drive #169), so it is purged instead, as useTrashEntries' purge does.
    await step(`purge ${REPORT_NAME}`, async () => {
      const row = await rowFor(pod, TRASH_CATALOG, `${trashEntry(TRASH_IDS.report)}index.ttl`);
      expectOk("purge", await deleteResource({
        containerUri: toContainerUri(row.uri), fetch: pod.fetch, catalogUri: TRASH_CATALOG, metadataUri: row.uri,
      }));
    });
  } finally {
    randomUuid.mockRestore();
    consoleLog.mockRestore();
    vi.useRealTimers();
  }

  return { documents, pod };
}
