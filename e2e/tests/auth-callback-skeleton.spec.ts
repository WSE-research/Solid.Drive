import { test, expect } from "../helpers/fixtures";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";
import { shot } from "../helpers/screenshots";

const FAKE_CALLBACK_URL = "/?code=fake-code&state=fake-state";

test("the auth-callback skeleton appears when the URL carries OIDC params", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  await page.goto(FAKE_CALLBACK_URL);

  const skeleton = page.locator("auth-callback-skeleton");
  await expect(skeleton).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await shot(page, "auth callback skeleton");
  await expect(skeleton).toHaveAttribute("role", "status");
  await expect(skeleton).toHaveAttribute("aria-busy", "true");
  await expect(skeleton).toHaveAttribute("aria-live", "polite");
});

test("the skeleton reuses the landing brand wordmark and renders shimmer bars", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  await page.goto(FAKE_CALLBACK_URL);

  const brand = page.locator(".auth-callback__brand");
  await expect(brand).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(brand).toContainText(/solid/i);
  await expect(brand.locator(".landing__title-accent")).toContainText(/drive/i);

  await expect(page.locator("auth-callback-bar")).toHaveCount(4);
  await shot(page, "auth callback brand and bars");
});

test("the HeroBlob backdrop is mounted behind the skeleton card", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  await page.goto(FAKE_CALLBACK_URL);

  await expect(page.locator("auth-callback-backdrop landing-hero-blob")).toBeVisible({
    timeout: UI_TIMEOUTS.short,
  });
  await shot(page, "auth callback backdrop");
});

test("the skeleton lifts after the boot window and the LandingPage takes over when auth never resolves", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  await page.goto(FAKE_CALLBACK_URL);
  await expect(page.locator("auth-callback-skeleton")).toBeVisible({ timeout: UI_TIMEOUTS.short });

  await expect(page.locator("main.landing")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await expect(page.locator("auth-callback-skeleton")).toHaveCount(0);
  await shot(page, "landing takes over");
});

test("a plain visit to / shows the LandingPage immediately, with no skeleton", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  await page.goto("/");

  await expect(page.locator("main.landing")).toBeVisible({ timeout: UI_TIMEOUTS.short });
  await expect(page.locator("auth-callback-skeleton")).toHaveCount(0);
  await shot(page, "landing page no skeleton");
});
