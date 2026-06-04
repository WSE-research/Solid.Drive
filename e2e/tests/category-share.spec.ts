import { test, expect, freshLogin } from "../helpers/fixtures";
import { addContact, grantDiscoveryAccess, seedFile } from "../helpers/seed";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Type-level access flow. One click of "Request all <type>" must go out as
 * a single inbox message, and approving it grants the requester read access
 * to every file of that schema.org class.
 */
test("Parni requests all images, Peach approves, the images appears in the ShareWithMe section", async ({ browser, peach, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

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

  // Parni: click "Request all"
  const parniSession = await freshLogin(browser, parni);
  const requestAllButton = parniSession.page.getByRole("button", { name: /Request all|Alle anfragen/i });
  await expect(requestAllButton).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await requestAllButton.click();
  await expect(parniSession.page.getByText(/Pending|Ausstehend/).first()).toBeVisible({ timeout: UI_TIMEOUTS.short });

  // Peach: approve the type-level request 
  const peachSession = await freshLogin(browser, peach);
  await peachSession.page.getByRole("button", { name: /^(Requests|Anfragen)/ }).click();
  await expect(peachSession.page.getByText(/all Image|alle Image/i)).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await peachSession.page.getByRole("button", { name: /^(Approve|Genehmigen)$/ }).click();
  await expect(
    peachSession.page.locator("requests-panel").getByText(/all Image|alle Image/i),
  ).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  // Parni reloads in a fresh context so the new ACL is picked up and sees the image in the ShareWithMe section, without any pending requests
  await parniSession.close();
  const parniAfter = await freshLogin(browser, parni);
  await expect(parniAfter.page.getByText("Holiday Photo")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(parniAfter.page.getByRole("button", { name: /Request all|Alle anfragen/i })).toHaveCount(0);

  await parniAfter.close();
  await peachSession.close();
});
