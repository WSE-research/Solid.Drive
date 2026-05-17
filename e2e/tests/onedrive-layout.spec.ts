import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Opting into the OneDrive layout shell and switching back out. The tests
 * click the real toggles (LayoutToggle in the Classic header and in the
 * OneDrive settings menu) because the toggles themselves are under test.
 */

test("user opts into the OneDrive layout from the Classic header", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);

  // Radix renders the toggle pills as single-select radios.
  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await page.getByRole("radio", { name: "OneDrive" }).click();

  await expect(page.getByTestId("onedrive-layout-root")).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.locator("nav-rail")).toBeVisible();
  await expect(page.locator("top-bar")).toBeVisible();
  await expect(page.locator(".odl-page-title")).toHaveText("Home");
  await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", "recent");
  await expect(page.locator("header.site-header")).toHaveCount(0);

  await close();
});

test("user switches back to the Classic layout from the TopBar settings menu", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Classic" }).click();

  await expect(page.locator("header.site-header")).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.getByTestId("onedrive-layout-root")).toHaveCount(0);

  await close();
});
