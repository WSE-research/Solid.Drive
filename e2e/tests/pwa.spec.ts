import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

const ICON_BASE = "/solid-hello-world-frontend-react/icons";

test("192×192 PWA icon is publicly accessible at its versioned URL", async ({ request }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  const response = await request.get(`${ICON_BASE}/pwa-192x192-v2.png`);
  expect(response.status()).toBe(200);
});

test("512×512 PWA icon is publicly accessible at its versioned URL", async ({ request }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  const response = await request.get(`${ICON_BASE}/pwa-512x512-v2.png`);
  expect(response.status()).toBe(200);
});

test("512×512 maskable icon is publicly accessible at its versioned URL", async ({ request }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  const response = await request.get(`${ICON_BASE}/maskable-512x512-v2.png`);
  expect(response.status()).toBe(200);
});

test("theme-color meta tag matches the Solid.drive brand colour #070738", async ({ page }) => {
  test.setTimeout(TEST_TIMEOUTS.short);
  await page.goto("/");
  const themeColor = await page.locator("meta[name='theme-color']").getAttribute("content");
  expect(themeColor).toBe("#070738");
});

test("install button appears when the browser fires beforeinstallprompt and disappears after appinstalled", async ({
  browser,
  parni,
}) => {
  test.setTimeout(TEST_TIMEOUTS.medium);
  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await expect(page.locator(".install-app-button")).toHaveCount(0);

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
      platforms: string[];
    };
    event.platforms = ["web"];
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });

  await expect(page.locator(".install-app-button")).toBeVisible({ timeout: UI_TIMEOUTS.short });

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));

  await expect(page.locator(".install-app-button")).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

  await close();
});
