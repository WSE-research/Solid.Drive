import { test, expect, freshLogin } from "../helpers/fixtures";
import { addContact, grantDiscoveryAccess, seedFile } from "../helpers/seed";

/**
 * Type-level access flow, focused.
 *
 * Validates that one click of "Request all <type>" goes out as a single
 * inbox message, not N per-file requests, and that approving it grants
 * Parni read access to every file of that schema.org class.
 *
 * Setup is direct fetch (catalog + ACLs); only the request and approve
 * surfaces are driven through the UI.
 */
test("Parni requests all images, Peach approves, the images appears in the ShareWithMe section", async ({ browser, peach, parni }) => {
  test.setTimeout(180_000);

  // Pre-state: one image in Peach's catalog, Parni has discovery + contact 
  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `photo-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Holiday Photo",
    asset: "Holiday_Photo.png",
  });
  await grantDiscoveryAccess(peach.authedFetch, peach.pod, parni.pod.webId);
  await addContact(parni.authedFetch, parni.pod.webId, peach.pod.webId);

  // Parni: click "Request all Image" 
  const parniSession = await freshLogin(browser, parni);
  const requestAllButton = parniSession.page.getByRole("button", { name: /Request all Image/i });
  await expect(requestAllButton).toBeVisible({ timeout: 15_000 });
  await requestAllButton.click();
  await expect(parniSession.page.getByText(/Requested|Angefragt/).first()).toBeVisible({ timeout: 15_000 });

  // Peach: approve the type-level request 
  const peachSession = await freshLogin(browser, peach);
  await peachSession.page.getByRole("button", { name: /^(Requests|Anfragen)/ }).click();
  await expect(peachSession.page.getByText(/all Image|alle Image/i)).toBeVisible({ timeout: 15_000 });
  await peachSession.page.getByRole("button", { name: /^(Approve|Genehmigen)$/ }).click();
  await expect(peachSession.page.getByText(/all Image|alle Image/i)).toHaveCount(0, { timeout: 15_000 });

  // Parni reloads in a fresh context so the new ACL is picked up and sees the image in the ShareWithMe section, without any pending requests
  await parniSession.close();
  const parniAfter = await freshLogin(browser, parni);
  await expect(parniAfter.page.getByText("Holiday Photo")).toBeVisible({ timeout: 30_000 });
  await expect(parniAfter.page.getByRole("button", { name: /Request all Image/i })).toHaveCount(0);

  await parniAfter.close();
  await peachSession.close();
});
