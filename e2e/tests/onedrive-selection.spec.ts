import { test, expect, freshLogin } from "../helpers/fixtures";
import { seedFile } from "../helpers/seed";
import { openMyFiles } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Selection-aware surfaces of the My Files view: the contextual action
 * strip in the page header and the actions behind it. Move and rename are
 * UI placeholders, and Download triggers a real file save; both are covered
 * in the unit suites instead.
 */

const SEEDED_FILE = {
  classUri: "http://schema.org/ImageObject",
  mediaType: "image/png",
  asset: "Holiday_Photo.png",
} as const;

test("selecting a file reveals the contextual action strip", async ({ browser, peach }) => {
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

  // Nothing selected: the page header shows the title and no action strip.
  await expect(page.locator(".odl-page-title")).toHaveText("My Files");
  await expect(page.locator("selection-actions")).toHaveCount(0);

  // Open my-solid-app, which is where the seed lives.
  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  const fileRow = page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  // Selecting the row swaps the title for the action strip and shows the
  // "1 selected" badge. Each resource action has its own button.
  await fileRow.click();
  await expect(fileRow).toHaveAttribute("aria-selected", "true");

  const strip = page.locator("selection-actions");
  await expect(strip).toBeVisible();
  await expect(page.locator(".odl-page-title")).toHaveCount(0);
  for (const action of ["Share", "Copy link", "Delete", "Download"]) {
    await expect(strip.getByRole("button", { name: action, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeVisible();

  // Clearing the selection brings the title back.
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.locator("selection-actions")).toHaveCount(0);
  await expect(page.locator(".odl-page-title")).toHaveText("My Files");

  await close();
});

test("Copy link writes the resource URI to the clipboard and confirms with a toast", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const { containerUri } = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    title: "Holiday Snapshot",
    ...SEEDED_FILE,
  });

  // The copy-link action writes via navigator.clipboard, which needs
  // clipboard permissions granted on the context.
  const { page, close } = await freshLogin(browser, peach, {
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await openMyFiles(page);

  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  const fileRow = page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await fileRow.click();

  await page.locator("selection-actions").getByRole("button", { name: "Copy link", exact: true }).click();

  // The success toast names the selected resource, and the clipboard
  // holds the per-file container URI that the row points at.
  await expect(page.locator(".toast")).toContainText("Holiday Snapshot");
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(containerUri);

  await close();
});

test("Delete asks for confirmation and removes the row on confirm", async ({ browser, peach }) => {
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

  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  const fileRow = page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await fileRow.click();

  // Delete opens the confirmation dialog. Cancelling leaves the row.
  await page.locator("selection-actions").getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.locator("confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".confirm-dialog__message")).toContainText("Holiday Snapshot");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(fileRow).toBeVisible();

  // Confirming deletes the per-file container. The row disappears, the
  // selection clears, and the header drops back to the title.
  await page.locator("selection-actions").getByRole("button", { name: "Delete", exact: true }).click();
  await page.locator("confirm-dialog").getByRole("button", { name: "Confirm" }).click();

  await expect(fileRow).toHaveCount(0, { timeout: UI_TIMEOUTS.medium });
  await expect(page.locator("selection-actions")).toHaveCount(0);
  await expect(page.locator(".odl-page-title")).toHaveText("My Files");

  await close();
});

test("Share opens the share dialog for the selected file", async ({ browser, peach }) => {
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

  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  const fileRow = page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await fileRow.click();

  // Share opens the modal that wraps the share panel.
  await page.locator("selection-actions").getByRole("button", { name: "Share", exact: true }).click();

  const dialog = page.locator(".odl-dialog-content");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".odl-dialog-title")).toHaveText("Share");
  await expect(dialog.locator("share-panel")).toBeVisible();

  // The dialog's Close button dismisses it.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".odl-dialog-content")).toHaveCount(0);

  await close();
});
