import type { Page } from "@playwright/test";
import { URLS, UI_TIMEOUTS } from "../config";

const cssUrlPattern = new RegExp(new URL(URLS.css).host);
const appUrlPattern = new RegExp(new URL(URLS.app).host);

/**
 * Drives the full Solid OIDC login flow against a CSS instance via the
 * Classic shell's auth form. Assumes the app is served at `URLS.app` and
 * CSS at `URLS.css`.
 *
 * @param page - Playwright page; starts at any URL, returns landed on the app
 * @param email - CSS account email
 * @param password - CSS account password
 */
export async function loginAsViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/");
  await page.locator("auth-provider-row select").selectOption("custom");
  await page.locator("auth-provider-row input").fill(URLS.css);

  await Promise.all([
    page.waitForURL(cssUrlPattern, { timeout: UI_TIMEOUTS.medium }),
    page.getByRole("button", { name: /log ?in|anmelden/i }).first().click(),
  ]);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[name="submit"]').click();

  // Optional consent step
  await page
    .getByRole("button", { name: /authorize|continue|allow|agree/i })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});

  await page.waitForURL(appUrlPattern, { timeout: UI_TIMEOUTS.medium });
}
