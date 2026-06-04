import { test, expect, freshLogin } from "../helpers/fixtures";
import { addContact, grantDiscoveryAccess, seedFile, shareFileWith } from "../helpers/seed";
import { revokeContactInSharePanel } from "../helpers/ui-actions";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Owner-side revoke flow, driven through the SharePanel UI. Complements
 * `revoke-keeps-visible.spec.ts`, which drives the ACL change via fetch and
 * asserts the requester-side rendering.
 */
test("Peach revokes via the share panel and Parni loses access", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const seeded = await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `revoke-ui-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Revoke Me",
    asset: "Birthday_Photo.png",
  });
  await grantDiscoveryAccess(peach.authedFetch, peach.pod, parni.pod.webId);
  await shareFileWith(peach.authedFetch, peach.pod, parni.pod.webId, seeded.containerUri);
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  // Pre-state: Parni sees the file as shared 
  const before = await freshLogin(browser, parni);
  await expect(before.page.locator("file-card").filter({ hasText: "Revoke Me" })).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await before.close();

  // Peach: navigate into `my-solid-app`, open SharePanel, revoke Parni access. 
  const peachSession = await freshLogin(browser, peach);
  await peachSession.page.getByText("my-solid-app", { exact: true }).click();
  await revokeContactInSharePanel(peachSession.page, "Revoke Me", "Parni");
  await expect(
    peachSession.page
      .locator("file-card")
      .filter({ hasText: "Revoke Me" })
      .locator("share-panel")
      .locator(".share-panel__name-text", { hasText: "Parni" }),
  ).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  // Parni re-logs in: file is no longer a shared FileCard, instead in "Also available" with a Request button.   
  const after = await freshLogin(browser, parni);
  await expect(after.page.locator("file-card").filter({ hasText: "Revoke Me" })).toHaveCount(0);
  await expect(after.page.getByRole("button", { name: /Request all|Alle anfragen/i })).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  await after.close();
  await peachSession.close();
});
