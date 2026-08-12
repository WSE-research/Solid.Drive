import type { Page } from "@playwright/test";
import { test, expect } from "../helpers/fixtures";
import { loginAsViaUI } from "../helpers/login-ui";
import { STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";
import { shot } from "../helpers/screenshots";

/**
 * The landing page's experience picker. One card for the classic layout
 * plus one card per available theme of the OneDrive shell — the cards are
 * derived from the exported THEMES list, so every theme (currently light,
 * dark and dropbox) is visible and pickable before login, and a future
 * fourth theme joins the picker by construction. Picking a theme card
 * writes BOTH preferences (layout `onedrive` + that theme). The point of
 * offering the themes before login is that the user lands in the restyled
 * shell without ever opening the Settings menu, which the signed-in test
 * at the bottom drives end to end.
 */

const CARD_NAMES = {
  classic: /classic|klassisch/i,
  light: /onedrive.*(light|hell)/i,
  dark: /onedrive.*(dark|dunkel)/i,
  dropbox: /dropbox/i,
  gdrive: /google drive/i,
} as const;

const gotoLanding = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.locator("main.landing").waitFor({ timeout: UI_TIMEOUTS.medium });
};

const storedPreferences = (page: Page) =>
  page.evaluate(
    (keys) => ({
      layout: localStorage.getItem(keys.layout),
      theme: localStorage.getItem(keys.theme),
    }),
    { layout: STORAGE_KEYS.layout, theme: STORAGE_KEYS.theme },
  );

test("the landing page offers every available theme and applies a pick on click", async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  // The classic card plus one card per available theme, all visible
  // before login.
  await expect(page.getByRole("radio", { name: CARD_NAMES.classic })).toBeVisible();
  await expect(page.getByRole("radio", { name: CARD_NAMES.light })).toBeVisible();
  await expect(page.getByRole("radio", { name: CARD_NAMES.dark })).toBeVisible();
  await expect(page.getByRole("radio", { name: CARD_NAMES.dropbox })).toBeVisible();
  await expect(page.getByRole("radio", { name: CARD_NAMES.gdrive })).toBeVisible();

  await page.getByRole("radio", { name: CARD_NAMES.dropbox }).click();

  // The pick applies immediately (the attribute the theme CSS keys off) and
  // persists both halves of the experience.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dropbox", {
    timeout: UI_TIMEOUTS.short,
  });
  await expect(page.getByRole("radio", { name: CARD_NAMES.dropbox })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(await storedPreferences(page)).toEqual({ layout: "onedrive", theme: "dropbox" });
  await shot(page, "dropbox experience selected");

  // Every other theme is equally pickable — no theme is a hidden second
  // step behind a layout card.
  await page.getByRole("radio", { name: CARD_NAMES.light }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light", {
    timeout: UI_TIMEOUTS.short,
  });
  expect(await storedPreferences(page)).toEqual({ layout: "onedrive", theme: "light" });

  await page.getByRole("radio", { name: CARD_NAMES.gdrive }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "gdrive", {
    timeout: UI_TIMEOUTS.short,
  });
  expect(await storedPreferences(page)).toEqual({ layout: "onedrive", theme: "gdrive" });

  await page.getByRole("radio", { name: CARD_NAMES.dark }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {
    timeout: UI_TIMEOUTS.short,
  });
  expect(await storedPreferences(page)).toEqual({ layout: "onedrive", theme: "dark" });

  // The classic card only moves the layout axis; the last theme choice
  // survives for a later return to the OneDrive shell.
  await page.getByRole("radio", { name: CARD_NAMES.classic }).click();
  expect(await storedPreferences(page)).toEqual({ layout: "classic", theme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("picking Dropbox at login lands the user in the restyled shell without touching Settings", async ({
  browser,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.medium);

  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoLanding(page);

  await page.getByRole("radio", { name: CARD_NAMES.dropbox }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dropbox", {
    timeout: UI_TIMEOUTS.short,
  });

  // Same context, so the preferences written by the click survive the OIDC
  // round trip through the identity provider.
  await loginAsViaUI(page, parni.email, parni.password);

  await page.locator("onedrive-layout").waitFor({ timeout: UI_TIMEOUTS.medium });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dropbox", {
    timeout: UI_TIMEOUTS.short,
  });

  // Not merely the attribute: the tokens DropboxTheme.css installs actually
  // resolve in the signed-in shell.
  const pageToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--odl-bg-page").trim(),
  );
  expect(pageToken).toBe("#ffffff");

  await shot(page, "dropbox shell entered from the landing pick");

  await context.close();
});
