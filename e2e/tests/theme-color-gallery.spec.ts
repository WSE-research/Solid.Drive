import { test, expect, freshLogin } from "../helpers/fixtures";
import { seedFile } from "../helpers/seed";
import { openMyFiles } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

/**
 * Theme × color-scheme showcase (issue #69, task 6).
 *
 * Captures the My Files view in every combination of the two dark/light
 * themes and the four accent color schemes (indigo, emerald, amber,
 * rose) into e2e/screenshots/showcase/my-files-<theme>-<scheme>.png. The
 * GitHub Pages "See it in action" switcher uses these images so visitors
 * can flip through every look. The test also asserts the scheme actually
 * re-tints the accent, so it doubles as coverage for the new feature.
 */

const THEMES = ["dark", "light"] as const;
const SCHEMES = ["indigo", "emerald", "amber", "rose"] as const;

const SHOWCASE_DIR = resolve(process.cwd(), "e2e", "screenshots", "showcase");

/** Applies a theme + scheme the way the app's hooks do, and settles. */
const applyAppearance = async (page: Page, theme: string, scheme: string): Promise<void> => {
  await page.evaluate(
    ({ theme, scheme }) => {
      localStorage.setItem("solid-drive.theme", theme);
      localStorage.setItem("solid-drive.color-scheme", scheme);
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.setAttribute("data-scheme", scheme);
      window.dispatchEvent(new CustomEvent("solid-drive:theme-changed"));
      window.dispatchEvent(new CustomEvent("solid-drive:color-scheme-changed"));
    },
    { theme, scheme },
  );
  // Let the token transitions settle before the screenshot.
  await page.waitForTimeout(250);
};

/** Reads the resolved --odl-brand token, i.e. the active accent. */
const readBrand = (page: Page): Promise<string> =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--odl-brand").trim(),
  );

test("captures My Files across every theme and color scheme", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.long);

  // Seed a couple of files so the My Files table has real content.
  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `holiday-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Holiday Snapshot",
    asset: "Holiday_Photo.png",
  });
  await seedFile({
    authedFetch: peach.authedFetch,
    pod: peach.pod,
    fileName: `birthday-${Date.now()}.png`,
    classUri: "http://schema.org/ImageObject",
    mediaType: "image/png",
    title: "Birthday Photo",
    asset: "Birthday_Photo.png",
  });

  const { page, close } = await freshLogin(browser, peach);
  await openMyFiles(page);

  // Open the app container so the seeded files are visible in the table.
  await page.locator(".odl-files-row--folder").filter({ hasText: "my-solid-app" }).click();
  await expect(
    page.locator(".odl-files-row--file").filter({ hasText: "Holiday Snapshot" }),
  ).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  const brandByScheme: Record<string, string> = {};

  for (const theme of THEMES) {
    for (const scheme of SCHEMES) {
      await applyAppearance(page, theme, scheme);
      if (theme === "dark") brandByScheme[scheme] = await readBrand(page);
      await page.screenshot({
        path: resolve(SHOWCASE_DIR, `my-files-${theme}-${scheme}.png`),
      });
    }
  }

  // The scheme must actually change the accent — every palette distinct.
  const distinctBrands = new Set(Object.values(brandByScheme));
  expect(distinctBrands.size).toBe(SCHEMES.length);

  await close();
});
