import type { Page } from "@playwright/test";
import { URLS, UI_TIMEOUTS } from "../config";

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
  await page.getByPlaceholder(/your-provider|ihr-pod-anbieter/i).fill(URLS.css);

  await Promise.all([
    page.waitForURL(cssUrlPattern, { timeout: UI_TIMEOUTS.medium }),
    page
      .getByRole("button", { name: /sign in with the selected|mit dem ausgewählten/i })
      .click(),
  ]);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[name="submit"]').click();

  await page
    .getByRole("button", { name: /authorize|continue|allow|agree/i })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});

  await page.waitForURL(appUrlPattern, { timeout: UI_TIMEOUTS.medium });
}
