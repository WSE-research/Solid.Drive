import type { Page } from "@playwright/test";
import { URLS, UI_TIMEOUTS } from "../config";
import { shot } from "./screenshots";

const cssUrlPattern = new RegExp(new URL(URLS.css).host);
const appUrlPattern = new RegExp(new URL(URLS.app).host);

/**
 * Drives the Solid OIDC login flow against CSS through the LandingPage.
 *
 * @param page - Playwright page; starts anywhere, ends on the app
 * @param email - CSS account email
 * @param password - CSS account password
 */
export async function loginAsViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/");
  await page.locator("main.landing").waitFor({ timeout: UI_TIMEOUTS.medium });
  await shot(page, "landing page");
  await page.getByPlaceholder(/your-provider|ihr-pod-anbieter/i).fill(URLS.css);

  await Promise.all([
    page.waitForURL(cssUrlPattern, { timeout: UI_TIMEOUTS.medium }),
    page
      .getByRole("button", { name: /sign in with the selected|mit dem ausgewählten/i })
      .click(),
  ]);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await shot(page, "identity provider login");
  await page.locator('button[name="submit"]').click();

  await page
    .getByRole("button", { name: /authorize|continue|allow|agree/i })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});

  await page.waitForURL(appUrlPattern, { timeout: UI_TIMEOUTS.medium });
  // Let the logged-in shell paint before documenting it; otherwise the
  // screenshot catches a blank app mid-boot. Best-effort so the helper's
  // contract (return once back on the app) is unchanged.
  await page
    .locator("auth-logged-in")
    .waitFor({ timeout: UI_TIMEOUTS.medium })
    .catch(() => {});
  await shot(page, "app loaded");
}
