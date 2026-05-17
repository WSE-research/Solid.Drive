import { test, expect, freshLogin } from "../helpers/fixtures";
import { addContact, grantDiscoveryAccess, seedFile } from "../helpers/seed";
import { denyTopRequest, expandTypeFolder } from "../helpers/ui-actions";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * When the owner denies a per-file access request, the requester's view
 * shows a "Denied" badge plus a "Request Again" button, driven by the
 * rejection notification posted to the requester's inbox.
 */
test("denied file request shows a Denied label with a Request Again button on the requester side", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `denied-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Denied Image",
    asset: "Birthday_Photo.png",
  });
  await grantDiscoveryAccess(peach.authedFetch, peach.pod, parni.pod.webId);
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  // Parni: request the file 
  const parniSession = await freshLogin(browser, parni);
  let imageFolder = await expandTypeFolder(parniSession.page, "Image");
  await imageFolder
    .locator("type-folder-file-row")
    .filter({ hasText: "Denied Image" })
    .getByRole("button", { name: /^(Request|Anfragen)$/ })
    .click();
  await expect(
    imageFolder.locator("type-folder-file-row").filter({ hasText: "Denied Image" }).getByText(/Requested|Angefragt/),
  ).toBeVisible({ timeout: UI_TIMEOUTS.short });

  // Peach: deny the request
  const peachSession = await freshLogin(browser, peach);
  await denyTopRequest(peachSession.page);
  await expect(peachSession.page.locator("requests-panel-item")).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  // Parni: re-login, see the Denied label on the row 
  await parniSession.close();
  const parniAfter = await freshLogin(browser, parni);
  imageFolder = await expandTypeFolder(parniAfter.page, "Image");
  const deniedRow = imageFolder.locator("type-folder-file-row").filter({ hasText: "Denied Image" });
  await expect(deniedRow.locator(".contact-row__denied")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(deniedRow.getByRole("button", { name: /Request Again|Erneut anfragen/i })).toBeVisible();

  await parniAfter.close();
  await peachSession.close();
});
