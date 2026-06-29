import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Desktop PWA installation support (issue #57).
 *
 * The first group runs without auth on the landing page and checks the
 * installability primitives: the linked manifest, its icons, the
 * theme-color / apple-touch-icon meta, and a registered service worker
 * that controls the page — all under Vite's BASE_URL. The second group
 * logs in and drives the topbar "Install app" control through a
 * simulated `beforeinstallprompt` / `appinstalled` lifecycle.
 */

// Vite `base` from vite.config.ts. The app is served under this prefix
// and every PWA asset must resolve beneath it.
const BASE_PATH = "/solid-hello-world-frontend-react/";

test.describe("PWA installability assets", () => {
  test("links a manifest under BASE_URL declaring the required install fields", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUTS.short);
    await page.goto("/");

    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe(`${BASE_PATH}manifest.webmanifest`);

    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBe("Solid.drive");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
    // Relative start_url/scope resolve against the manifest URL, so they
    // honour BASE_URL without any build-time templating.
    expect(manifest.start_url).toBe(".");
    expect(manifest.scope).toBe(".");

    const icons = manifest.icons as Array<{ sizes: string; purpose?: string }>;
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512")).toBe(true);
    expect(
      icons.some((i) => i.sizes === "512x512" && (i.purpose ?? "").includes("maskable")),
    ).toBe(true);
  });

  test("serves every manifest icon as a PNG under BASE_URL", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUTS.short);
    await page.goto("/");

    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await page.request.get(href!)).json();

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const iconUrl = `${BASE_PATH}${icon.src}`;
      const res = await page.request.get(iconUrl);
      expect(res.ok(), `${iconUrl} should be served`).toBe(true);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
  });

  test("declares a theme-color meta and an apple-touch-icon under BASE_URL", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUTS.short);
    await page.goto("/");

    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", /#[0-9a-fA-F]{3,6}/);
    const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect(appleIcon).toBe(`${BASE_PATH}icons/icon-192.png`);
  });

  test("registers a service worker that controls the page under BASE_URL", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUTS.short);
    await page.goto("/");

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(scope.endsWith(BASE_PATH)).toBe(true);

    // skipWaiting + clients.claim mean the worker takes control without a
    // reload, so the page ends up controlled by ${BASE_URL}sw.js.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: UI_TIMEOUTS.short,
    });
    const controllerUrl = await page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? null,
    );
    expect(controllerUrl).not.toBeNull();
    expect(controllerUrl!.endsWith(`${BASE_PATH}sw.js`)).toBe(true);
  });
});

test.describe("PWA install control", () => {
  test("shows on beforeinstallprompt, fires the prompt, and hides after install", async ({
    browser,
    parni,
  }) => {
    test.setTimeout(TEST_TIMEOUTS.short);

    const { page, close } = await freshLogin(browser, parni);
    await enterOneDriveLayout(page);
    // The topbar (and the install button's effect) is mounted once the
    // Account control is present.
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible({
      timeout: UI_TIMEOUTS.medium,
    });

    const installButton = page.getByTestId("install-app-button");
    // Hidden until the browser offers an install prompt.
    await expect(installButton).toHaveCount(0);

    // Simulate Chromium offering the install prompt.
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt");
      Object.assign(event, {
        platforms: ["web"],
        prompt: () => {
          (window as unknown as { __installPromptShown?: boolean }).__installPromptShown = true;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      });
      window.dispatchEvent(event);
    });

    await expect(installButton).toBeVisible({ timeout: UI_TIMEOUTS.short });

    await installButton.click();
    const promptShown = await page.evaluate(
      () => (window as unknown as { __installPromptShown?: boolean }).__installPromptShown === true,
    );
    expect(promptShown).toBe(true);

    // Once installed, the browser fires appinstalled and the control hides.
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(installButton).toHaveCount(0, { timeout: UI_TIMEOUTS.short });

    await close();
  });
});
