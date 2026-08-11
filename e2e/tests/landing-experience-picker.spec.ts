import type { Page } from "@playwright/test";
import { test, expect } from "../helpers/fixtures";
import { loginAsViaUI } from "../helpers/login-ui";
import { STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";
import { shot } from "../helpers/screenshots";

/**
 * The landing page's experience picker. Three radio cards: the classic
 * layout, the OneDrive-inspired layout, and the Dropbox-inspired experience
 * -- which is the OneDrive layout wearing `data-theme="dropbox"`, so picking
 * it must write BOTH preferences. The point of offering it before login is
 * that the user lands in the restyled shell without ever opening the
 * Settings menu, which the signed-in test at the bottom drives end to end.
 */

const CARD_NAMES = {
  classic: /classic|klassisch/i,
  onedrive: /onedrive/i,
  dropbox: /dropbox/i,
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

test("the landing page offers the Dropbox-inspired experience and applies it on click", async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  // All three cards are visible before login.
  await expect(page.getByRole("radio", { name: CARD_NAMES.classic })).toBeVisible();
  await expect(page.getByRole("radio", { name: CARD_NAMES.onedrive })).toBeVisible();
  await expect(page.getByRole("radio", { name: CARD_NAMES.dropbox })).toBeVisible();

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

  // Stepping back to the OneDrive card restores the default theme rather
  // than leaving the Dropbox skin on a card that no longer claims it.
  await page.getByRole("radio", { name: CARD_NAMES.onedrive }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {
    timeout: UI_TIMEOUTS.short,
  });
  expect(await storedPreferences(page)).toEqual({ layout: "onedrive", theme: "dark" });

  // The classic card only moves the layout axis.
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
