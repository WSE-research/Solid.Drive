import { test, expect, freshLogin } from "../helpers/fixtures";
import {
  addContact,
  grantDiscoveryAccess,
  seedFile,
  shareFileWith,
  unshareFileWith,
} from "../helpers/seed";
import { expandTypeFolder } from "../helpers/ui-actions";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Regression for the "revoke loses visibility" bug. Revoking a shared file
 * used to drop the entry entirely, leaving no way to ask again. With the
 * fix, `useSharedCatalog` falls back to the owner's main catalog and
 * re-classifies entries `hasAccess` rejects as browsable, so the file shows
 * up under "Also available" with a Request button. Drives the ACL change
 * via fetch, not the SharePanel UI, to focus on the requester-side
 * rendering.
 */
test("revoking access moves a previously-shared file into Also available, not gone", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const seeded = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `revoke-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "To Be Revoked",
    asset: "Holiday_Photo.png",
  });
  await grantDiscoveryAccess(peach.authedFetch, peach.pod, parni.pod.webId);
  await shareFileWith(peach.authedFetch, peach.pod, parni.pod.webId, seeded.containerUri);
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  // Pre-state: Parni sees the file as shared 
  const before = await freshLogin(browser, parni);
  await expect(before.page.getByText("To Be Revoked")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(before.page.getByRole("button", { name: /Request all|Alle anfragen/i })).toHaveCount(0);
  await before.close();

  // Owner revokes by writing a new ACL without Parni 
  await unshareFileWith(peach.authedFetch, peach.pod, seeded.containerUri);

  // Parni re-logs in: the entry is now under "Also available", not gone, and
  // can be requested again. Expand the type folder, assert the row is there
  // with a Request button, and that it no longer renders as a shared FileCard.
  const after = await freshLogin(browser, parni);
  const imageFolder = await expandTypeFolder(after.page, "Image");
  const revokedRow = imageFolder.locator("type-folder-file-row").filter({ hasText: "To Be Revoked" });
  await expect(revokedRow).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(revokedRow.getByRole("button", { name: /^(Request|Anfragen)$/ })).toBeVisible();
  await expect(after.page.locator("file-card").filter({ hasText: "To Be Revoked" })).toHaveCount(0);
  await after.close();
});
