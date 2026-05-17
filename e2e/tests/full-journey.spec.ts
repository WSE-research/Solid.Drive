import { test, expect, freshLogin } from "../helpers/fixtures";
import { seedFile } from "../helpers/seed";
import {
  addContactViaUI,
  approveTopRequest,
  clickRequestAccessForContact,
  expandTypeFolder,
} from "../helpers/ui-actions";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Full UI journey, end to end. Every interaction goes through the real DOM,
 * including the contact-add and catalog-request flows the focused tests
 * bypass with direct fetch. Slower than the focused specs, but catches
 * multi-step regressions like state resets and stale caches.
 *
 *   1. Parni adds Peach's WebID
 *   2. Parni requests catalog access
 *   3. Peach approves catalog
 *   4. Parni sees Peach's catalog under "Also available"
 *   5. Parni requests one specific file
 *   6. Peach approves the file
 *   7. Parni sees that file as shared, the rest still browsable
 *   8. Parni requests the entire remaining type
 *   9. Peach approves
 *  10. Parni sees both files as shared
 */
test("full UI journey: add contact → catalog approve → per-file request → type request", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.long);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `single-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Single Image",
    asset: "Holiday_Photo.png",
  });
  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `bulk-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Bulk Image",
    asset: "Birthday_Photo.png",
  });

  // 1–3. Parni adds Peach as contact and requests catalog access
  let parniSession = await freshLogin(browser, parni);
  await addContactViaUI(parniSession.page, peach.pod.webId);
  await expect(parniSession.page.locator("contact-row").filter({ hasText: "Peach" })).toBeVisible({ timeout: UI_TIMEOUTS.short });

  await clickRequestAccessForContact(parniSession.page, "Peach");
  await expect(
    parniSession.page.locator("contact-row").filter({ hasText: "Peach" }).getByText(/Requested|Angefragt/),
  ).toBeVisible({ timeout: UI_TIMEOUTS.short });

  // Peach approves catalog access 
  const peachSession = await freshLogin(browser, peach);
  await approveTopRequest(peachSession.page);
  await expect(peachSession.page.locator("requests-panel-item")).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  // 4. Parni reloads, now sees Peach's items under "Also available" 
  await parniSession.close();
  parniSession = await freshLogin(browser, parni);
  await expect(parniSession.page.getByText(/Also available|Auch verfügbar/i)).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  let imageFolder = await expandTypeFolder(parniSession.page, "Image");
  await expect(imageFolder.getByText("Single Image")).toBeVisible();
  await expect(imageFolder.getByText("Bulk Image")).toBeVisible();

  // 5–6. Parni requests one file; Peach approves 
  await imageFolder
    .locator("type-folder-file-row")
    .filter({ hasText: "Single Image" })
    .getByRole("button", { name: /^(Request|Anfragen)$/ })
    .click();
  await expect(
    imageFolder.locator("type-folder-file-row").filter({ hasText: "Single Image" }).getByText(/Requested|Angefragt/),
  ).toBeVisible({ timeout: UI_TIMEOUTS.short });

  await peachSession.page.goto("/");
  await approveTopRequest(peachSession.page);
  await expect(peachSession.page.locator("requests-panel-item")).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  // 7. Parni reloads: Single Image is shared, Bulk Image still browsable 
  await parniSession.close();
  parniSession = await freshLogin(browser, parni);
  await expect(parniSession.page.locator("file-card").filter({ hasText: "Single Image" })).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  imageFolder = await expandTypeFolder(parniSession.page, "Image");
  await expect(imageFolder.getByText("Bulk Image")).toBeVisible();

  // 8–9. Parni requests the rest of the type; Peach approves 
  await imageFolder.getByRole("button", { name: /Request all Image/i }).click();
  await expect(imageFolder.getByText(/Requested|Angefragt/).first()).toBeVisible({ timeout: UI_TIMEOUTS.short });

  await peachSession.page.goto("/");
  await approveTopRequest(peachSession.page);
  await expect(peachSession.page.locator("requests-panel-item")).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  // 10. Parni reloads: both files shared, "Request all" gone 
  await parniSession.close();
  parniSession = await freshLogin(browser, parni);
  await expect(parniSession.page.locator("file-card").filter({ hasText: "Single Image" })).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(parniSession.page.locator("file-card").filter({ hasText: "Bulk Image" })).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(parniSession.page.getByRole("button", { name: /Request all Image/i })).toHaveCount(0);

  await parniSession.close();
  await peachSession.close();
});
