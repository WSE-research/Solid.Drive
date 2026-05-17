import { test, expect, freshLogin } from "../helpers/fixtures";
import { seedFile } from "../helpers/seed";
import { openMyFiles } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * My Files view in the OneDrive shell: Pod browser, detail panel, Create
 * menu, search. Needs real Pod content, so the `peach` fixture seeds the
 * profile and `seedFile` writes the catalog rows before driving the UI.
 * Drag-and-drop uploads, the full upload form, and sort ordering live in
 * the unit suites.
 */

test("My Files renders the Pod browser table", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  // The browse table has a four-column header shared with the search table.
  for (const column of ["Name", "Modified", "File size", "Sharing"]) {
    await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
  }

  // Peach's Pod root contains the app container as a plain folder row.
  await expect(
    page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }),
  ).toBeVisible();

  await close();
});

test("browsing into a folder shows a seeded file and selecting it fills the detail panel", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Holiday Snapshot",
    asset: "Holiday_Photo.png",
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  // Seeded files live under my-solid-app/, so open that folder first.
  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  await expect(page.locator("nav.odl-breadcrumb")).toBeVisible();

  // The seeded file shows as a file row, titled from its catalog entry.
  const fileRow = page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" });
  await expect(fileRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  // Clicking the row selects it; the detail panel is opened separately via
  // the Details toggle and then reflects the selected file.
  await fileRow.click();
  await expect(fileRow).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Details", exact: true }).click();
  const detailPanel = page.locator("detail-panel");
  await expect(detailPanel).toHaveAttribute("data-open", "true");
  await expect(detailPanel.locator("h3")).toHaveText("Holiday Snapshot");

  await close();
});

test("the Create menu opens the New folder dialog and creates a folder", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  // The rail's Create button opens a menu; "New folder" opens the dialog.
  await page.locator("nav-rail").getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("menuitem", { name: "New folder" }).click();

  const dialog = page.locator(".odl-dialog--new-folder");
  await expect(dialog).toBeVisible();

  // The folder name is slugified by useCreateFolder; an already-slug-shaped
  // name keeps the created row's label predictable.
  const folderName = `e2e-folder-${Date.now()}`;
  await dialog.locator("#odl-new-folder-name").fill(folderName);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  // The dialog closes and the new folder appears as a folder row.
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".odl-files-row--folder").filter({ hasText: folderName }),
  ).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  await close();
});

test("searching from the top bar filters to matching files", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Holiday Snapshot",
    asset: "Holiday_Photo.png",
  });
  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `birthday-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Birthday Bash",
    asset: "Birthday_Photo.png",
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  // Search reads the catalog, so it works from the Pod root without
  // navigating into my-solid-app/. Typing a title swaps the browse table
  // for the search results table.
  await page.getByRole("searchbox", { name: "Search" }).fill("Holiday");

  await expect(
    page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" }),
  ).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(
    page.locator(".odl-files-row").filter({ hasText: "Birthday Bash" }),
  ).toHaveCount(0);

  await close();
});
