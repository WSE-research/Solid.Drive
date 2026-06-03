import { test, expect, freshLogin, type UserFixture } from "../helpers/fixtures";
import {
  addContact,
  grantDiscoveryAccess,
  seedFile,
  shareFileWith,
} from "../helpers/seed";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Selection-aware surfaces of the OneDrive Shared view: the contextual
 * action strip that takes over the page-header when a shared row is
 * selected, the in-app preview dialog behind Open, and a real Download.
 * The MyFiles counterpart lives in onedrive-selection.spec.ts; this one
 * exercises the same shell from the receiver side.
 */

const SHARED_IMAGE = {
  classUri: "http://schema.org/ImageObject",
  mediaType: "image/png",
  asset: "Holiday_Photo.png",
} as const;

async function seedAndShareWithParni(
  peach: UserFixture,
  parniWebId: string,
  title: string,
) {
  const seeded = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `shared-${Date.now()}.png`,
    title,
    ...SHARED_IMAGE,
  });
  await grantDiscoveryAccess(peach.authedFetch, peach.pod, parniWebId);
  await shareFileWith(peach.authedFetch, peach.pod, parniWebId, seeded.containerUri);
  return seeded;
}

test("selecting a shared row swaps the toolbar for the selection actions strip", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "shared");

  // With nothing selected the tabs are visible and the selection-actions strip is absent.
  const tablist = page.getByRole("tablist", { name: "Shared" });
  await expect(tablist).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.locator("selection-actions")).toHaveCount(0);

  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });

  // Selecting a row mounts the selection-mode page-header with Open + Download
  // and a "1 selected" badge.
  await fileRow.click();
  await expect(fileRow).toHaveAttribute("aria-selected", "true");

  const strip = page.locator("selection-actions");
  await expect(strip).toBeVisible();
  await expect(tablist).toHaveCount(0);
  for (const action of ["Open", "Download"]) {
    await expect(strip.getByRole("button", { name: action, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeVisible();

  // Clearing the selection brings the tabs back.
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.locator("selection-actions")).toHaveCount(0);
  await expect(tablist).toBeVisible();

  await close();
});

test("Open shows the in-app preview dialog with the file content and a close control", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "shared");

  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });
  await fileRow.click();

  // Open triggers the modal. The dialog title is the file's display name,
  // and the body resolves to the FileMediaPreview <img> for image/png.
  await page.locator("selection-actions").getByRole("button", { name: "Open", exact: true }).click();

  const dialog = page.locator(".odl-preview-dialog");
  await expect(dialog).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(dialog.locator(".odl-dialog-title")).toHaveText("Holiday Snapshot");
  await expect(dialog.locator("file-preview-body img.file-card__preview")).toBeVisible({
    timeout: UI_TIMEOUTS.medium,
  });

  // The dialog's Close button dismisses it; selection survives so the user
  // can immediately trigger Download from the same toolbar.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".odl-preview-dialog")).toHaveCount(0);
  await expect(fileRow).toHaveAttribute("aria-selected", "true");

  await close();
});

test("the preview dialog body shows the loading state before the binary finishes loading", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const seeded = await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);

  // Stall the binary fetch so the loading state stays on screen long enough
  // to assert. The route hands the request back to the browser only after a
  // short delay, then lets the real response finish the preview.
  await page.route(seeded.binaryUri, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await enterOneDriveLayout(page, "shared");
  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });
  await fileRow.click();
  await page.locator("selection-actions").getByRole("button", { name: "Open", exact: true }).click();

  // While the fetch is stalled the body carries `data-state="loading"` and
  // shows the spinner. Once the route resolves the body swaps to the image.
  const body = page.locator("file-preview-body");
  await expect(body).toHaveAttribute("data-state", "loading");
  await expect(body.locator(".spinner")).toBeVisible();
  await expect(body.locator("img.file-card__preview")).toBeVisible({
    timeout: UI_TIMEOUTS.medium,
  });
  await expect(body).not.toHaveAttribute("data-state", "loading");

  await close();
});

test("the in-dialog Download button triggers a real download for the previewed file", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "shared");

  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });
  await fileRow.click();
  await page.locator("selection-actions").getByRole("button", { name: "Open", exact: true }).click();

  const dialog = page.locator(".odl-preview-dialog");
  await expect(dialog).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  // The dialog's own Download button reuses the same handler as the strip,
  // so the resulting filename starts with the selected entry's title.
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Holiday Snapshot/);

  await close();
});

test("the preview dialog surfaces an error state when the binary fetch fails", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const seeded = await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);

  // Force the binary fetch to fail so the catch path in FilePreviewDialog
  // pushes the body into the error state with a human-readable reason.
  await page.route(seeded.binaryUri, (route) =>
    route.fulfill({ status: 503, contentType: "text/plain", body: "Service Unavailable" }),
  );

  await enterOneDriveLayout(page, "shared");
  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });
  await fileRow.click();
  await page.locator("selection-actions").getByRole("button", { name: "Open", exact: true }).click();

  const body = page.locator("file-preview-body");
  await expect(body).toHaveAttribute("data-state", "error", { timeout: UI_TIMEOUTS.medium });
  await expect(body).toContainText("Could not load preview");
  await expect(body).toContainText("503");

  await close();
});

test("Download streams the shared binary through the session-bound fetch", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "shared");

  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });
  await fileRow.click();

  // downloadResource uses an anchor click with a blob URL; Playwright
  // surfaces that as a regular download event.
  const downloadPromise = page.waitForEvent("download");
  await page.locator("selection-actions").getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  // Chrome appends the MIME-derived extension (.png) onto the anchor's
  // download name; we only assert the leading title.
  expect(download.suggestedFilename()).toMatch(/^Holiday Snapshot/);

  await close();
});

test("Escape clears the active selection", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedAndShareWithParni(peach, parni.pod.webId, "Holiday Snapshot");
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "shared");

  const fileRow = page.locator("shared-files-row").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.long });
  await fileRow.click();
  await expect(page.locator("selection-actions")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("selection-actions")).toHaveCount(0);
  await expect(fileRow).toHaveAttribute("aria-selected", "false");

  await close();
});
