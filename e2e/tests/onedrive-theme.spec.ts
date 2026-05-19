import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * The OneDrive theme toggle. Lives in the TopBar's Settings menu and is
 * backed by `useThemePreference`, which persists the choice to
 * localStorage and mirrors it onto `document.documentElement` as
 * `data-theme="dark" | "light"`. The light overrides in
 * `OneDriveLayout.light.css` are keyed off that attribute.
 */

const openThemeSelect = async (page: Awaited<ReturnType<typeof freshLogin>>["page"]) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme" }).click();
};

test("defaults to the dark theme on first load", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {
    timeout: UI_TIMEOUTS.short,
  });

  await close();
});

test("the settings menu switches to the light theme and persists across reload", async ({
  browser,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await openThemeSelect(page);
  await page.getByRole("option", { name: "Light" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light", {
    timeout: UI_TIMEOUTS.short,
  });
  const stored = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    STORAGE_KEYS.theme,
  );
  expect(stored).toBe("light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light", {
    timeout: UI_TIMEOUTS.short,
  });

  await close();
});

test("switching from light back to dark updates the document attribute", async ({
  browser,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await openThemeSelect(page);
  await page.getByRole("option", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light", {
    timeout: UI_TIMEOUTS.short,
  });
  // Selecting an item inside the Settings dropdown leaves the parent
  // DropdownMenu open; dismiss it before opening Settings again.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "Theme" })).toHaveCount(0, {
    timeout: UI_TIMEOUTS.short,
  });

  await openThemeSelect(page);
  await page.getByRole("option", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {
    timeout: UI_TIMEOUTS.short,
  });
  const stored = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    STORAGE_KEYS.theme,
  );
  expect(stored).toBe("dark");

  await close();
});
