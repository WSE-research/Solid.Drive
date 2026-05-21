import { test, expect, freshLogin } from "../helpers/fixtures";
import { postCatalogAccessRequest } from "../helpers/seed";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * NotificationBell + RequestNotificationsContext end-to-end coverage.
 *
 * One actor (Peach) is the pod owner whose inbox receives access requests.
 * Parni's authenticated fetch posts request messages directly to Peach's
 * inbox so the spec stays deterministic. The consumer side (bell, badge,
 * toast, dropdown, navigation) is what we're driving.
 *
 * The bell mounts in both shells. OneDrive surfaces it in the TopBar and a
 * click-through opens the Requests view. The Classic shell surfaces it in
 * the Header and a click-through auto-opens the RequestsPanel.
 */

test("OneDrive bell shows the unseen badge and click-through navigates to the Requests view", async ({
  browser,
  peach,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await postCatalogAccessRequest(
    parni.authedFetch,
    peach.pod.inboxUri,
    parni.pod.webId,
    peach.pod.webId,
  );

  const { page, close } = await freshLogin(browser, peach);
  await enterOneDriveLayout(page);

  const bell = page.getByTestId("notification-bell").first();
  const badge = page.getByTestId("notification-bell-badge").first();
  await expect(bell).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(badge).toHaveText("1", { timeout: UI_TIMEOUTS.medium });

  await bell.click();
  const dropdownItem = page.getByRole("menuitem").filter({ hasText: "Parni" });
  await expect(dropdownItem).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await dropdownItem.click();

  await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", "requests", {
    timeout: UI_TIMEOUTS.short,
  });
  await expect(page.getByTestId("request-card").first()).toBeVisible({
    timeout: UI_TIMEOUTS.short,
  });
  await expect(badge).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  await close();
});

test("a new request arriving while the page is open ticks the badge up and fires a toast", async ({
  browser,
  peach,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const { page, close } = await freshLogin(browser, peach);
  await enterOneDriveLayout(page);

  const bell = page.getByTestId("notification-bell").first();
  await expect(bell).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(page.getByTestId("notification-bell-badge")).toHaveCount(0);

  await postCatalogAccessRequest(
    parni.authedFetch,
    peach.pod.inboxUri,
    parni.pod.webId,
    peach.pod.webId,
  );

  // The provider listens on `focus` + `visibilitychange` as a defensive
  // refresh path alongside the Solid Notifications WebSocket. Triggering
  // the listener directly keeps the test deterministic. The live-refresh
  // contract is what we want to assert, regardless of whether the WS
  // channel handshakes in time inside headless CSS.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page.getByTestId("notification-bell-badge").first()).toHaveText("1", {
    timeout: UI_TIMEOUTS.long,
  });
  // Match either the resolved profile name ("Parni") or the WebID-derived
  // fallback ("parni"). The toast firer races a 1500ms timeout, and under
  // full-suite load the LDO profile fetch can lose that race.
  await expect(page.locator(".toast--info").filter({ hasText: /parni/i })).toBeVisible({
    timeout: UI_TIMEOUTS.long,
  });

  await close();
});

test("duplicate inbox messages for the same request collapse into one row", async ({
  browser,
  peach,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await postCatalogAccessRequest(
    parni.authedFetch,
    peach.pod.inboxUri,
    parni.pod.webId,
    peach.pod.webId,
  );
  await postCatalogAccessRequest(
    parni.authedFetch,
    peach.pod.inboxUri,
    parni.pod.webId,
    peach.pod.webId,
  );

  const { page, close } = await freshLogin(browser, peach);
  await enterOneDriveLayout(page, "requests");

  await expect(page.getByTestId("request-card")).toHaveCount(1, {
    timeout: UI_TIMEOUTS.long,
  });

  await close();
});

test("Classic bell click-through auto-opens the RequestsPanel and highlights the row", async ({
  browser,
  peach,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  await postCatalogAccessRequest(
    parni.authedFetch,
    peach.pod.inboxUri,
    parni.pod.webId,
    peach.pod.webId,
  );

  const { page, close } = await freshLogin(browser, peach);
  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  const bell = page.getByTestId("notification-bell").first();
  await expect(bell).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(page.getByTestId("notification-bell-badge").first()).toHaveText("1", {
    timeout: UI_TIMEOUTS.medium,
  });

  await bell.click();
  await page.getByRole("menuitem").filter({ hasText: "Parni" }).click();

  const panel = page.locator("requests-panel");
  await expect(panel.locator("requests-panel-body")).toBeVisible({
    timeout: UI_TIMEOUTS.short,
  });
  await expect(panel.locator('requests-panel-item[data-highlighted="true"]')).toBeVisible({
    timeout: UI_TIMEOUTS.short,
  });

  await close();
});
