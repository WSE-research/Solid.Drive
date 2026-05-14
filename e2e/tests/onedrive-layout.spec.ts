import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";

/**
 * Tests for opting into the OneDrive layout shell and switching back out
 * of it.
 *
 * The app has two shells over the same Pod-browsing core, and which one is
 * shown is chosen by a preference stored in localStorage. These tests click
 * the real toggles (the LayoutToggle in the Classic header, and the same
 * control in the OneDrive settings menu) rather than writing the preference
 * directly, because the toggles themselves are what is being tested.
 */

test("user opts into the OneDrive layout from the Classic header", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);

  // Wait until the Classic header shows its logged-in state, which is where
  // the LayoutToggle lives. Radix renders the toggle's pills as single-select
  // radios, so they are found by the radio role.
  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("radio", { name: "OneDrive" }).click();

  // Clicking the pill should swap the Classic shell out for the OneDrive
  // shell: the nav rail, the top bar, the page header, and the default
  // Home view. OneDriveLayout renders the page title in its page header,
  // and the main panel carries the active view id in data-view.
  await expect(page.getByTestId("onedrive-layout-root")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("nav-rail")).toBeVisible();
  await expect(page.locator("top-bar")).toBeVisible();
  await expect(page.locator(".odl-page-title")).toHaveText("Home");
  await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", "recent");
  await expect(page.locator("header.site-header")).toHaveCount(0);

  await close();
});

test("user switches back to the Classic layout from the TopBar settings menu", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  // The settings menu in the TopBar hosts the same LayoutToggle. 
  // Open it and pick the "Classic" radio to switch the shell back.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Classic" }).click();

  await expect(page.locator("header.site-header")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("onedrive-layout-root")).toHaveCount(0);

  await close();
});
