import { Parser } from "n3";
import { test, expect, freshLogin } from "../helpers/fixtures";
import { seedFile, shareFileWith, type PodIdentity } from "../helpers/seed";
import { openMyFiles, navigateToView } from "../helpers/onedrive";
import { shot } from "../helpers/screenshots";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

const DCAT_DATASET = "http://www.w3.org/ns/dcat#dataset";
const DCTERMS_TITLE = "http://purl.org/dc/terms/title";

/**
 * Coverage for Recycle Bin operations.
 *
 * Soft deletion moves a resource into the pod-wide `trash/` container.
 * Restoration must recreate the resource at its original URI and restore its
 * associated ACL. Permanent deletion removes the trashed resource completely,
 * either individually or through "Empty recycle bin".
 *
 * The initial move-to-bin flow is covered in `onedrive-selection.spec.ts`.
 * These tests focus on operations performed after an item has entered the
 * Recycle Bin: restore, permanent deletion, bulk deletion, and retention-based
 * cleanup.
 */

const SEEDED_FILE = {
  classUri: "http://schema.org/ImageObject",
  mediaType: "image/png",
  asset: "Holiday_Photo.png",
} as const;

/** `trash/catalog.ttl` at the pod storage root. */
function trashCatalogUri(pod: PodIdentity): string {
  return `${pod.storageRoot}trash/catalog.ttl`;
}

/**
 * Resolves a trashed item's container from the trash catalog.
 *
 * Trash container names are UUIDs, so the URI cannot be derived from the
 * original filename. The catalog is therefore the source of truth.
 */
async function findTrashItemContainerUri(
  authedFetch: typeof fetch,
  pod: PodIdentity,
  title: string,
): Promise<string> {
  const catalogUri = trashCatalogUri(pod);
  const deadline = Date.now() + UI_TIMEOUTS.medium;

  while (true) {
    const response = await authedFetch(catalogUri);
    if (response.ok) {
      const quads = new Parser({ baseIRI: catalogUri }).parse(await response.text());
      const datasetUris = quads.filter((quad) => quad.predicate.value === DCAT_DATASET).map((quad) => quad.object.value);
      for (const datasetUri of datasetUris) {
        const hasMatchingTitle = quads.some(
          (quad) => quad.subject.value === datasetUri && quad.predicate.value === DCTERMS_TITLE && quad.object.value === title,
        );
        if (hasMatchingTitle) return datasetUri.replace(/index\.ttl$/, "");
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(`No trash catalog entry titled "${title}" found at ${catalogUri} (last fetch: ${response.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Moves a file to the Recycle Bin through the UI and verifies that it
 * disappears from its original folder.
 *
 * @param alreadyInFolder Whether the page is already inside `my-solid-app`.
 * 
 */
async function moveToBinViaUi(
  page: import("@playwright/test").Page,
  title: string,
  alreadyInFolder = false,
): Promise<void> {
  if (!alreadyInFolder) {
    await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  }
  const fileRow = page.locator(".odl-files-row--file").filter({ hasText: title });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await fileRow.click();
  await page.locator("selection-actions").getByRole("button", { name: "Move to bin", exact: true }).click();
  await page.locator("confirm-dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(fileRow).toHaveCount(0, { timeout: UI_TIMEOUTS.medium });
  // The row can disappear from a live container listing before the soft
  // delete's own catalog/tombstone writes have landed; the success toast
  // only fires once that full write has settled, so callers that close
  // the page or navigate away right after this must wait for it too.
  await expect(page.locator(".toast").last()).toContainText("moved to the Recycle bin", { timeout: UI_TIMEOUTS.medium });
  await shot(page, `${title} moved to recycle bin`);
}

test("Restore returns the file to My Files, removes it from the Recycle bin, and preserves its ACL", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.long);

  const seeded = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });
  // Grant another user access before deletion so the test can verify that
  // restoration preserves the resource's ACL rather than rebuilding a new one.
  await shareFileWith(peach.authedFetch, peach.pod, parni.pod.webId, seeded.containerUri);
  const aclBeforeDelete = await peach.authedFetch(`${seeded.containerUri}.acl`);
  expect(aclBeforeDelete.ok).toBe(true);
  const originalAclBody = await aclBeforeDelete.text();

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await moveToBinViaUi(page, "Holiday Snapshot");

  await navigateToView(page, "Recycle bin");
  const trashRow = page.locator("trash-row").filter({ hasText: "Holiday Snapshot" });
  await expect(trashRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  await trashRow.getByRole("button", { name: /^Restore/ }).click();
  await expect(trashRow).toHaveCount(0, { timeout: UI_TIMEOUTS.medium });
  await expect(page.locator(".toast").last()).toContainText("Holiday Snapshot");
  await shot(page, "Holiday Snapshot restored");

  // Restored at its exact original location, in a fresh context so LDO's
  // subject cache does not serve stale pre-restore state.
  await close();
  const after = await freshLogin(browser, peach);
  await openMyFiles(after.page);
  await after.page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  await expect(
    after.page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" }),
  ).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await shot(after.page, "Holiday Snapshot back at its original location");

  const aclAfterRestore = await peach.authedFetch(`${seeded.containerUri}.acl`);
  expect(aclAfterRestore.ok).toBe(true);
  expect(await aclAfterRestore.text()).toBe(originalAclBody);

  await after.close();
});

test("Restore does not overwrite a resource that now occupies the original URI", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const seeded = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });

  const started = await freshLogin(browser, peach);
  await openMyFiles(started.page);
  await moveToBinViaUi(started.page, "Holiday Snapshot");
  await started.close();

  // Something else now occupies the original location.
  const occupyingBody = "not the original file";
  const occupyResponse = await peach.authedFetch(seeded.instanceUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: occupyingBody,
  });
  expect(occupyResponse.ok).toBe(true);

  // Fresh browser context: restoring reads the original location straight
  // from the pod, and a session that had it open before the write above
  // must not serve a pre-write view of it.
  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await navigateToView(page, "Recycle bin");
  const trashRow = page.locator("trash-row").filter({ hasText: "Holiday Snapshot" });
  await expect(trashRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  await trashRow.getByRole("button", { name: /^Restore/ }).click();
  await expect(page.locator(".toast").last()).toContainText("A file already exists at the original location");
  await shot(page, "restore blocked by occupied destination");

  // The trash copy is left in place, not silently dropped or overwritten.
  await expect(trashRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  // The resource that occupies the original location is untouched.
  const occupyingResponse = await peach.authedFetch(seeded.instanceUri);
  expect(occupyingResponse.ok).toBe(true);
  expect(await occupyingResponse.text()).toBe(occupyingBody);

  await close();
});

test("Restore succeeds for a resource with no ACL of its own, and does not create one", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const seeded = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });
  const aclBeforeDelete = await peach.authedFetch(`${seeded.containerUri}.acl`);
  expect(aclBeforeDelete.status).toBe(404);

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await moveToBinViaUi(page, "Holiday Snapshot");

  await navigateToView(page, "Recycle bin");
  const trashRow = page.locator("trash-row").filter({ hasText: "Holiday Snapshot" });
  await expect(trashRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  await trashRow.getByRole("button", { name: /^Restore/ }).click();
  await expect(trashRow).toHaveCount(0, { timeout: UI_TIMEOUTS.medium });
  await expect(page.locator(".toast").last()).toContainText("Holiday Snapshot");
  await shot(page, "Holiday Snapshot restored with no ACL");

  const aclAfterRestore = await peach.authedFetch(`${seeded.containerUri}.acl`);
  expect(aclAfterRestore.status).toBe(404);

  await close();
});

test("Delete permanently from the Recycle bin removes the trash copy for good", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await moveToBinViaUi(page, "Holiday Snapshot");

  await navigateToView(page, "Recycle bin");
  const trashRow = page.locator("trash-row").filter({ hasText: "Holiday Snapshot" });
  await expect(trashRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  const trashContainerUri = await findTrashItemContainerUri(peach.authedFetch, peach.pod, "Holiday Snapshot");

  await trashRow.getByRole("button", { name: /^Delete permanently/ }).click();
  await page.locator("confirm-dialog").getByRole("button", { name: "Confirm" }).click();

  await expect(trashRow).toHaveCount(0, { timeout: UI_TIMEOUTS.medium });
  await expect(page.locator("trash-empty")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await shot(page, "Holiday Snapshot permanently deleted");

  // Nothing left registered in the trash catalog. The catalog write can
  // still be settling when the success toast appears, so a single read
  // right after it can catch the entry before it's gone.
  await expect
    .poll(
      async () => {
        const catalogResponse = await peach.authedFetch(trashCatalogUri(peach.pod));
        return catalogResponse.ok ? await catalogResponse.text() : "";
      },
      { timeout: UI_TIMEOUTS.medium },
    )
    .not.toContain("Holiday Snapshot");

  // The physical trash container is gone too, not just the catalog row.
  await expect
    .poll(async () => (await peach.authedFetch(trashContainerUri)).status, { timeout: UI_TIMEOUTS.medium })
    .toBe(404);

  await close();
});

test("Empty recycle bin permanently deletes every trashed item at once", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.long);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });
  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `sunset-${Date.now()}.png`,
    title: "Sunset Snapshot",
    ...SEEDED_FILE,
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await moveToBinViaUi(page, "Holiday Snapshot");
  await moveToBinViaUi(page, "Sunset Snapshot", true);

  await navigateToView(page, "Recycle bin");
  await expect(page.locator("trash-row")).toHaveCount(2, { timeout: UI_TIMEOUTS.medium });
  const holidayContainerUri = await findTrashItemContainerUri(peach.authedFetch, peach.pod, "Holiday Snapshot");
  const sunsetContainerUri = await findTrashItemContainerUri(peach.authedFetch, peach.pod, "Sunset Snapshot");

  await page.getByRole("button", { name: "Empty recycle bin", exact: true }).click();
  await page.locator("confirm-dialog").getByRole("button", { name: "Confirm" }).click();

  await expect(page.locator("trash-row")).toHaveCount(0, { timeout: UI_TIMEOUTS.medium });
  await expect(page.locator("trash-empty")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await shot(page, "recycle bin emptied");
  // The button itself disappears along with the last row.
  await expect(page.getByRole("button", { name: "Empty recycle bin", exact: true })).toHaveCount(0);

  const catalogResponse = await peach.authedFetch(trashCatalogUri(peach.pod));
  const catalogBody = catalogResponse.ok ? await catalogResponse.text() : "";
  expect(catalogBody).not.toContain("Holiday Snapshot");
  expect(catalogBody).not.toContain("Sunset Snapshot");

  // Both physical trash containers are gone too, not just the catalog rows.
  await expect
    .poll(async () => (await peach.authedFetch(holidayContainerUri)).status, { timeout: UI_TIMEOUTS.medium })
    .toBe(404);
  await expect
    .poll(async () => (await peach.authedFetch(sunsetContainerUri)).status, { timeout: UI_TIMEOUTS.medium })
    .toBe(404);

  await close();
});

test("An item past its retention window is purged the moment the Recycle bin is opened", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await moveToBinViaUi(page, "Holiday Snapshot");

  // Back-date the tombstone's expiresAt to force it past retention,
  // mirroring what softDeleteFile itself writes but with a past timestamp.
  const trashItemContainerUri = await findTrashItemContainerUri(peach.authedFetch, peach.pod, "Holiday Snapshot");
  const tombstoneUri = `${trashItemContainerUri}tombstone.ttl`;
  const tombstoneResponse = await peach.authedFetch(tombstoneUri);
  expect(tombstoneResponse.ok).toBe(true);
  const currentTombstone = await tombstoneResponse.text();
  const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const expiredTombstone = currentTombstone.replace(
    /#expiresAt> "[^"]+"/,
    `#expiresAt> "${pastExpiry}"`,
  );
  const putResponse = await peach.authedFetch(tombstoneUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: expiredTombstone,
  });
  expect(putResponse.ok).toBe(true);

  await navigateToView(page, "Recycle bin");

  // The expired row never renders because the catalog is re-read and the expired item is purged immediately.
  await expect(page.locator("trash-empty")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect
    .poll(async () => (await peach.authedFetch(trashItemContainerUri)).status, { timeout: UI_TIMEOUTS.medium })
    .toBe(404);
  await shot(page, "expired item auto-purged");

  await close();
});

test("An item still within its retention window remains in the Recycle bin", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);
  await moveToBinViaUi(page, "Holiday Snapshot");

  await navigateToView(page, "Recycle bin");
  const trashRow = page.locator("trash-row").filter({ hasText: "Holiday Snapshot" });
  await expect(trashRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await shot(page, "non-expired item survives cleanup");

  const trashItemContainerUri = await findTrashItemContainerUri(peach.authedFetch, peach.pod, "Holiday Snapshot");
  const containerCheck = await peach.authedFetch(trashItemContainerUri);
  expect(containerCheck.status).toBe(200);

  await close();
});
