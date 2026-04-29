import type { Page } from "@playwright/test";
import { CSS_BASE_URL } from "./css-auth";

/**
 * Drives the full Solid OIDC login flow against a CSS instance.
 * Assumes the app is on baseURL and CSS is at CSS_BASE_URL.
 */
export async function loginAsViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/");
  await page.locator("auth-provider-row select").selectOption("custom");
  await page.locator("auth-provider-row input").fill(CSS_BASE_URL);

  await Promise.all([
    page.waitForURL(/localhost:3001/, { timeout: 30_000 }),
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

  await page.waitForURL(/localhost:5173/, { timeout: 30_000 });
}
