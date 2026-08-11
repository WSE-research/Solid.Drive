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
  // The 2025/2026 Dropbox design is white-on-white with hairline separation;
  // blue survives as the selection/focus accent only (primary buttons are
  // near-black via --odl-brand, asserted through the rendered chrome below).
  expect(tokens.page).toBe("#ffffff");
  expect(tokens.accent).toBe("#0061ff");
  expect(tokens.text).toBe("#1a1918");
  expect(tokens.rowHeight).toBe("48px");

  // And that the tokens reach the rendered chrome rather than only :root.
  await expect(page.locator("top-bar")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  // Primary actions are near-black in the 2025/2026 design. The Create button
  // renders through --odl-brand-gradient, so the flat colour shows up as a
  // one-stop gradient in the computed background-image.
  await expect(page.locator(".rail-create")).toHaveCSS(
    "background-image",
    "linear-gradient(rgb(26, 25, 24), rgb(26, 25, 24))",
  );

  // --odl-detail-width has to be declared on `onedrive-layout`, because the
  // base stylesheet declares it there on a responsive ladder and `detail-panel`
  // inherits from the nearer ancestor -- a `:root` declaration is simply never
  // seen, however specific. Read it off the element that actually consumes it.
  const detailWidth = await page.evaluate(() => {
    const layout = document.querySelector("onedrive-layout");
    return layout ? getComputedStyle(layout).getPropertyValue("--odl-detail-width").trim() : null;
  });
  expect(detailWidth).toBe("320px");

  // The theme must not pin the rail open. Pinning --odl-rail-width on
  // `onedrive-layout` outranks both `[data-rail-expanded="false"]` and the
  // max-width:960px collapse, which leaves a dead gutter when the user
  // collapses the rail and costs a tablet the width permanently.
  //
  // This drives the attribute rather than the toggle button because what is
  // under test is the cascade, not the toggle's wiring (covered in
  // onedrive-nav-rail.spec.ts). The grid track is transitioned over 320ms, so
  // the assertion has to retry -- reading it synchronously catches an
  // intermediate value.
  const railColumn = () =>
    page.evaluate(() => {
      const layout = document.querySelector("onedrive-layout");
      return layout ? getComputedStyle(layout).gridTemplateColumns.split(" ")[0] : null;
    });

  await page.evaluate(() =>
    document.querySelector("onedrive-layout")?.setAttribute("data-rail-expanded", "false"),
  );
  await expect.poll(railColumn, { timeout: UI_TIMEOUTS.short }).toBe("68px");

  await page.evaluate(() =>
    document.querySelector("onedrive-layout")?.setAttribute("data-rail-expanded", "true"),
  );
  await expect.poll(railColumn, { timeout: UI_TIMEOUTS.short }).toBe("232px");

  await shot(page, "dropbox-theme-shell");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dropbox", {
    timeout: UI_TIMEOUTS.short,
  });

  await close();
});
