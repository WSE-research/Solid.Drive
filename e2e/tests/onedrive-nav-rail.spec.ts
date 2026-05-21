import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout, navigateToView, toggleNavRail } from "../helpers/onedrive";
import { APP_EVENTS, STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Nav rail expand / collapse pane. Defaults to expanded on first visit,
 * toggles between states, persists across reloads, and keeps the active
 * view indicated in both states.
 */

test("the nav rail starts expanded by default", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await expect(page.locator("nav-rail")).toHaveAttribute("data-expanded", "true");
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "Create or upload", exact: true }),
  ).toBeVisible();

  await close();
});

test("clicking the collapse toggle switches to the icon-only rail", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await toggleNavRail(page);

  await expect(page.locator("nav-rail")).toHaveAttribute("data-expanded", "false");
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "Create", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "Create or upload", exact: true }),
  ).toHaveCount(0);

  await close();
});

test("clicking expand from the icon-only rail restores the wide pane", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await toggleNavRail(page);
  await expect(page.locator("nav-rail")).toHaveAttribute("data-expanded", "false");

  await toggleNavRail(page);
  await expect(page.locator("nav-rail")).toHaveAttribute("data-expanded", "true");

  await close();
});

test("the active view is marked with aria-current in both states", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await navigateToView(page, "Shared");
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "Shared", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await toggleNavRail(page);
  await expect(page.locator("nav-rail")).toHaveAttribute("data-expanded", "false");
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "Shared", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await close();
});

test("the account name is shown when expanded and hidden when collapsed", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await expect(page.locator(".rail-account-name")).toHaveText("Parni", { timeout: UI_TIMEOUTS.short });

  await toggleNavRail(page);

  await expect(page.locator(".rail-account-name")).toHaveCount(0);

  await close();
});

test("toggling writes to localStorage and dispatches the change event", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  const eventFired = page.evaluate(
    (eventName) =>
      new Promise<boolean>((resolve) => {
        window.addEventListener(eventName, () => resolve(true), { once: true });
      }),
    APP_EVENTS.navRailExpandedChanged,
  );

  await toggleNavRail(page);

  await expect.poll(
    () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEYS.navRailExpanded),
    { timeout: UI_TIMEOUTS.short },
  ).toBe("false");
  await expect(await eventFired).toBe(true);

  await close();
});
