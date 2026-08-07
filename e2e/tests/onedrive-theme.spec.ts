import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";
import { shot } from "../helpers/screenshots";

/**
 * The OneDrive theme toggle. Lives in the TopBar's Settings menu and is
 * backed by `useThemePreference`, which persists the choice to
 * localStorage and mirrors it onto `document.documentElement` as
 * `data-theme="dark" | "light" | "dropbox"`. The overrides in
 * `OneDriveLayout.light.css` and `DropboxTheme.css` are keyed off that
 * attribute, so the Dropbox test asserts on the attribute and then on the
 * computed styles that attribute is supposed to produce -- an attribute
 * alone would still pass if the stylesheet were never loaded.
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

test("the settings menu switches to the Dropbox theme and actually restyles the shell", async ({
  browser,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await openThemeSelect(page);
  await page.getByRole("option", { name: "Dropbox" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dropbox", {
    timeout: UI_TIMEOUTS.short,
  });
  const stored = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    STORAGE_KEYS.theme,
  );
  expect(stored).toBe("dropbox");

  // Dismiss the still-open Settings dropdown so the screenshot shows the shell.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "Theme" })).toHaveCount(0, {
    timeout: UI_TIMEOUTS.short,
  });

  // The attribute is only half the story: assert the tokens DropboxTheme.css
  // is supposed to install actually resolve. If the stylesheet were missing
  // from the bundle or lost the cascade, these would still hold the base
  // theme's dark values.
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      page: styles.getPropertyValue("--odl-bg-page").trim(),
      accent: styles.getPropertyValue("--odl-accent").trim(),
      text: styles.getPropertyValue("--odl-text").trim(),
      rowHeight: styles.getPropertyValue("--odl-row-height").trim(),
    };
  });
  expect(tokens.page).toBe("#f7f5f2");
  expect(tokens.accent).toBe("#0061ff");
  expect(tokens.text).toBe("#1e1919");
  expect(tokens.rowHeight).toBe("48px");

  // And that the tokens reach the rendered chrome rather than only :root.
  await expect(page.locator("top-bar")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await shot(page, "dropbox-theme-shell");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dropbox", {
    timeout: UI_TIMEOUTS.short,
  });

  await close();
});
