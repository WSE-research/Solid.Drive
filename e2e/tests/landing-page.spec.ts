import type { Page } from "@playwright/test";
import { test, expect } from "../helpers/fixtures";
import { STORAGE_KEYS, TEST_TIMEOUTS, UI_TIMEOUTS, URLS } from "../config";
import { shot } from "../helpers/screenshots";

const CUSTOM_ISSUER_PLACEHOLDER = /your-provider|ihr-pod-anbieter/i;
const LOGIN_BUTTON_NAME = /sign in with the selected|mit dem ausgewählten/i;
const PROVIDERS_TRIGGER_NAME = /show providers|anbieter anzeigen/i;
const PROVIDERS_LISTBOX_ID = "landing-providers-heading-listbox";

const gotoLanding = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.addInitScript((key) => {
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
  }, STORAGE_KEYS.layout);
  await page.locator("main.landing").waitFor({ timeout: UI_TIMEOUTS.medium });
  await shot(page, "landing page");
};

const openProviderListbox = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: PROVIDERS_TRIGGER_NAME }).click();
  await shot(page, "provider listbox open");
};

const isListboxOpen = (page: Page) =>
  page.evaluate(
    (id) => document.getElementById(id)?.getAttribute("data-state") === "open",
    PROVIDERS_LISTBOX_ID,
  );

test("landing page renders the brand, subtitle, top nav and fork ribbon", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/solid/i);
  await expect(page.locator(".landing__subtitle")).toBeVisible();
  await expect(page.getByRole("link", { name: /no pod yet|noch kein pod/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /^video$/i })).toBeVisible();
  const forkRibbon = page.locator(".landing__fork-ribbon");
  await expect(forkRibbon).toBeVisible();
  await expect(forkRibbon).toHaveAttribute("href", /github\.com\//);
});

test("landing page renders the provider trigger, custom issuer input, layout picker and login actions", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await expect(page.getByRole("button", { name: PROVIDERS_TRIGGER_NAME })).toBeVisible();
  await expect(page.getByPlaceholder(CUSTOM_ISSUER_PLACEHOLDER)).toBeVisible();
  await expect(page.getByRole("radio", { name: /classic|klassisch/i })).toBeVisible();
  await expect(page.getByRole("radio", { name: /onedrive/i })).toBeVisible();
  await expect(page.getByRole("button", { name: LOGIN_BUTTON_NAME })).toBeVisible();
  await expect(page.getByRole("link", { name: /create a pod|pod erstellen/i })).toBeVisible();
});

test("the HTWK Leipzig demo server is the default-selected provider and listed", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await expect(
    page.getByRole("button", { name: PROVIDERS_TRIGGER_NAME }),
  ).toContainText(/htwk leipzig/i);

  await openProviderListbox(page);
  await expect(
    page.locator(`#${PROVIDERS_LISTBOX_ID} [role="option"]`).filter({ hasText: /htwk leipzig/i }),
  ).toBeVisible();
});

test("opening the provider listbox and picking an option updates the trigger", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await openProviderListbox(page);
  expect(await isListboxOpen(page)).toBe(true);

  const inruptOption = page
    .locator(`#${PROVIDERS_LISTBOX_ID} [role="option"]`)
    .filter({ hasText: /inrupt/i });
  await inruptOption.click();

  expect(await isListboxOpen(page)).toBe(false);
  await expect(page.getByRole("button", { name: PROVIDERS_TRIGGER_NAME })).toContainText(/inrupt/i);
});

test("pressing Escape closes the open provider listbox", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await openProviderListbox(page);
  await page.keyboard.press("Escape");
  expect(await isListboxOpen(page)).toBe(false);
});

test("clicking outside the combobox closes the open provider listbox", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await openProviderListbox(page);
  await page.locator(".landing__subtitle").click();
  expect(await isListboxOpen(page)).toBe(false);
});

test("an invalid custom issuer URL shows an inline error and disables Login", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await page.getByPlaceholder(CUSTOM_ISSUER_PLACEHOLDER).fill("not a url");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: LOGIN_BUTTON_NAME })).toBeDisabled();
});

test("typing a valid custom issuer URL clears the error and enables Login", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  const input = page.getByPlaceholder(CUSTOM_ISSUER_PLACEHOLDER);
  await input.fill("not a url");
  await expect(page.getByRole("alert")).toBeVisible();

  await input.fill(URLS.css);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".landing__field-hint")).toBeVisible();
  await expect(page.getByRole("button", { name: LOGIN_BUTTON_NAME })).toBeEnabled();
});

test("picking a layout writes the preference to localStorage", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await page.getByRole("radio", { name: /onedrive/i }).click();
  const stored = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    STORAGE_KEYS.layout,
  );
  expect(stored).toBe("onedrive");
});

test("the No Pod link navigates to the onboarding sub-route and renders the four steps", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await page.getByRole("link", { name: /no pod yet|noch kein pod/i }).click();
  await expect(page).toHaveURL(/\/no-pod$/);
  await expect(page.locator(".landing__step")).toHaveCount(4);
  await expect(page.getByRole("link", { name: /walkthrough|einführungsvideo/i })).toBeVisible();
});

test("the Video link navigates to the walkthrough sub-route and renders the video", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await page.getByRole("link", { name: /^video$/i }).click();
  await expect(page).toHaveURL(/\/video$/);
  await expect(page.locator("video.landing__video-player")).toBeVisible();
  await expect(page.locator(".landing__video-caption")).toBeVisible();
});

test("the back link on a sub-route returns to the sign-in view", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await gotoLanding(page);

  await page.getByRole("link", { name: /no pod yet|noch kein pod/i }).click();
  await expect(page).toHaveURL(/\/no-pod$/);
  await page.getByRole("link", { name: /back to sign in|zurück zur anmeldung/i }).click();

  await expect(page).not.toHaveURL(/\/no-pod$/);
  await expect(page).not.toHaveURL(/\/video$/);
  await expect(page.getByRole("button", { name: LOGIN_BUTTON_NAME })).toBeVisible();
});

test("Login with a valid custom issuer navigates to that issuer", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.medium);
  await gotoLanding(page);

  await page.getByPlaceholder(CUSTOM_ISSUER_PLACEHOLDER).fill(URLS.css);

  await Promise.all([
    page.waitForURL(new RegExp(new URL(URLS.css).host), { timeout: UI_TIMEOUTS.medium }),
    page.getByRole("button", { name: LOGIN_BUTTON_NAME }).click(),
  ]);
});
