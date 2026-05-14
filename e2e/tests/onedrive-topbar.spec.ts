import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";

/**
 * Tests for the OneDrive TopBar. It has two menus: the avatar menu, which
 * shows the signed-in profile and the log out action, and the settings menu,
 * which switches the UI language.
 *
 * The profile fields shown in the avatar menu come from the signed-in user's
 * Pod. The test fixture seeds Parni's profile with the name "Parni", so the
 * menu is expected to show that name along with her WebID.
 */

test("the avatar menu surfaces the signed-in profile", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  // Open the avatar menu. It should show the seeded profile name and WebID.
  await page.getByRole("button", { name: "Account", exact: true }).click();

  await expect(page.locator("topbar-menu-profile-name")).toHaveText("Parni", { timeout: 15_000 });
  await expect(page.locator("topbar-menu-profile-webid")).toContainText(parni.pod.webId);
  // Radix applies the menuitem role to the underlying <a> through its
  // asChild prop, so this element is not exposed as a link. Match it by
  // class name instead of by role.
  await expect(page.locator("a.topbar-menu__item--link")).toHaveAttribute("href", parni.pod.webId);

  await close();
});

test("the settings menu switches the UI language", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  // The UI starts in English, so the rail button reads "My Files".
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "My Files", exact: true }),
  ).toBeVisible();

  // Open the settings menu and pick German from the language radio group.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Deutsch" }).click();

  // The whole shell should re-render in German: the same rail button now
  // reads "Meine Dateien" and the view title reads "Startseite".
  await expect(
    page.locator("nav-rail").getByRole("button", { name: "Meine Dateien", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".odl-view-title")).toHaveText("Startseite");

  await close();
});

test("the user logs out from the avatar menu", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  // Open the avatar menu and use its log out item.
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: /Log out/i }).click();

  // Logging out clears the session, and with it the session-continuity flag
  // that keeps the OneDrive shell mounted. The app should fall back to the
  // Classic logged-out view, which shows the auth provider row.
  await expect(page.getByTestId("onedrive-layout-root")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("auth-provider-row")).toBeVisible();

  await close();
});
