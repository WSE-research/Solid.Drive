import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";
import { shot } from "../helpers/screenshots";

/**
 * Opting into the OneDrive layout shell and switching back out. The tests
 * click the real controls (the ExperienceSwitcher in the Classic header and
 * the Theme select's "Classic" option in the OneDrive settings menu) because
 * the controls themselves are under test.
 *
 * Both places now offer the same flat list of experiences rather than a
 * layout axis with the themes hidden behind a separate control, so the last
 * test drives the Google-Drive-inspired theme end to end from Classic.
 */

const EXPERIENCE_SWITCHER = { name: /experience|ansicht/i } as const;

test("user opts into the OneDrive layout from the Classic header", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);

  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await page
    .getByRole("combobox", EXPERIENCE_SWITCHER)
    .selectOption({ label: "OneDrive (Dark)" });

  await expect(page.getByTestId("onedrive-layout-root")).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.locator("nav-rail")).toBeVisible();
  await expect(page.locator("top-bar")).toBeVisible();
  // The Recent view renders its own toolbar with an internal heading;
  // the page-header is suppressed for Recent, People, and Shared.
  await expect(page.locator(".odl-recent__heading")).toHaveText("Recent");
  await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", "recent");
  await expect(page.locator("header.site-header")).toHaveCount(0);

  await close();
});

test("user switches back to the Classic layout from the TopBar settings menu", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme" }).click();
  await page.getByRole("option", { name: "Classic" }).click();

  await expect(page.locator("header.site-header")).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.getByTestId("onedrive-layout-root")).toHaveCount(0);

  await close();
});

test("the Classic header switches straight into the Google-Drive-inspired theme", async ({
  browser,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  const switcher = page.getByRole("combobox", EXPERIENCE_SWITCHER);
  // Every theme is offered in the Classic header itself — no detour through
  // the OneDrive shell's Settings menu.
  await expect(switcher).toHaveValue("classic");
  await expect(switcher.locator("option")).toHaveCount(5);

  await switcher.selectOption("gdrive");

  // One interaction moves both axes: the OneDrive shell mounts wearing the
  // Google Drive theme.
  await expect(page.getByTestId("onedrive-layout-root")).toBeVisible({
    timeout: UI_TIMEOUTS.short,
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "gdrive", {
    timeout: UI_TIMEOUTS.short,
  });
  expect(
    await page.evaluate(
      (keys) => ({
        layout: localStorage.getItem(keys.layout),
        theme: localStorage.getItem(keys.theme),
      }),
      { layout: STORAGE_KEYS.layout, theme: STORAGE_KEYS.theme },
    ),
  ).toEqual({ layout: "onedrive", theme: "gdrive" });

  // Not merely the attribute: the tokens GoogleDriveTheme.css installs
  // actually resolve in the shell the Classic header just opened.
  const pageToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--odl-bg-page").trim(),
  );
  expect(pageToken).toBe("#f8fafd");
  await shot(page, "gdrive shell entered from the classic header");

  // Going back to Classic moves only the layout axis, so the theme is still
  // there for the next visit.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme" }).click();
  await page.getByRole("option", { name: "Classic" }).click();

  await expect(page.locator("header.site-header")).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.getByRole("combobox", EXPERIENCE_SWITCHER)).toHaveValue("classic");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.theme),
  ).toBe("gdrive");

  await close();
});
