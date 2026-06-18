import { test, expect, freshLogin } from "../helpers/fixtures";
import { removeProfileStorage, seedFile } from "../helpers/seed";
import { openMyFiles } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Storage discovery validation for Community Solid Server pods. Since CSS pods
 * do not advertise pim:storage on the WebID profile, usePodDiscovery must fall
 * back to discoverStorageRoot, which traverses upward from the WebID document
 * using Link rel=type headers to locate the pim:Storage-typed container. The
 * test fixture's ensureProfileBasics patches this by adding pim:storage, so
 * these tests remove that property first to exercise the genuine fallback path.
 */

test("discovers the storage root via the Link-header walk when the profile has no pim:storage", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await removeProfileStorage(peach.authedFetch, peach.pod);

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  // The browser only renders once a storage root resolved. Reaching it with no
  // pim:storage in the profile proves the walk climbed to the pod root.
  await expect(
    page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }),
  ).toBeVisible({ timeout: UI_TIMEOUTS.long });

  await close();
});

test("the discovered root is the user's pod, not the server root, so seeded files are browsable", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `discovered-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Discovered Photo",
    asset: "Holiday_Photo.png",
  });
  await removeProfileStorage(peach.authedFetch, peach.pod);

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  await expect(
    page.locator(".odl-files-row--file").filter({ hasText: "Discovered Photo" }),
  ).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  await close();
});
