import { test, expect, freshLogin } from "../helpers/fixtures";
import {
  addContact,
  grantDiscoveryAccess,
  seedFile,
  shareFileWith,
  unshareFileWith,
} from "../helpers/seed";
import { expandTypeFolder } from "../helpers/ui-actions";

/**
 * Regression test for the revoke loses visibility bug. When the owner
 * revokes a previously shared file, the requester's view used to drop
 * the entry entirely, leaving them with no way to ask again. The fix:
 * `useAclManager.revoke` no longer removes the entry from the per-viewer
 * shared catalog, and `useSharedCatalog` re-classifies entries that
 * `hasAccess` rejects as browsable.
 *
 * This spec drives the ACL change directly via fetch (no SharePanel UI)
 * to keep the focus on the requester side rendering.
 */
test("revoking access moves a previously-shared file into Also available, not gone", async ({ browser, peach, parni }) => {
  test.setTimeout(180_000);

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
  await expect(before.page.getByText("To Be Revoked")).toBeVisible({ timeout: 30_000 });
  await expect(before.page.getByRole("button", { name: /Request all Image/i })).toHaveCount(0);
  await before.close();

  // Owner revokes by writing a new ACL without Parni 
  await unshareFileWith(peach.authedFetch, peach.pod, seeded.containerUri);

  // Parni re-logs in: the entry is now under "Also available" — not gone — and can be
  // requested again. We expand the type folder and assert the row is there with a
  // Request button, plus that it is no longer rendered as a shared FileCard.
  const after = await freshLogin(browser, parni);
  const imageFolder = await expandTypeFolder(after.page, "Image");
  const revokedRow = imageFolder.locator("type-folder-file-row").filter({ hasText: "To Be Revoked" });
  await expect(revokedRow).toBeVisible({ timeout: 30_000 });
  await expect(revokedRow.getByRole("button", { name: /^(Request|Anfragen)$/ })).toBeVisible();
  await expect(after.page.locator("file-card").filter({ hasText: "To Be Revoked" })).toHaveCount(0);
  await after.close();
});
