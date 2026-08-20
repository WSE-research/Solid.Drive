import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Step-by-step screenshot capture for the e2e suite (issue #68).
 *
 * Every documented workflow step drops a numbered screenshot into a
 * per-test folder under `e2e/screenshots/<test-name>/`, so the suite
 * doubles as living, picture-by-picture documentation of the typical
 * user journeys.
 *
 * Capture is opt-in so a plain `npm run test:e2e` stays fast and leaves
 * no files behind — in CI as much as locally, where capturing them was
 * costing a lot of GitHub Actions minutes. Set `E2E_SCREENSHOTS=1` to
 * turn it on; the `e2e-screenshots` skill refreshes the committed
 * documentation set before a commit.
 *
 * The shared helpers in this folder call {@link shot} after each
 * meaningful action, so most tests are documented with no per-test
 * wiring. New inline steps can be captured with {@link shot} or grouped
 * and captured with {@link step}.
 */

/** Repository-root-relative folder all screenshots are written under. */
export const SCREENSHOTS_ROOT = resolve(process.cwd(), "e2e", "screenshots");

/**
 * Whether step screenshots should be captured for this run. Off unless
 * `E2E_SCREENSHOTS=1` is set — CI deliberately has no say here, so no
 * workflow can switch the (expensive) capture back on by accident.
 */
export const screenshotsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.E2E_SCREENSHOTS === "1";

/** Lower-cases and dashes a string into a filesystem-safe segment. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

/**
 * Derives the per-test folder name from Playwright's `titlePath`. The
 * leading project entry (e.g. `chromium`) is dropped, so the folder
 * reads as `<spec-file>-<describe>-<test-title>`.
 */
export const testFolderName = (titlePath: string[]): string =>
  slugify(titlePath.slice(1).join(" "));

// Per-test capture state. The suite runs serially on a single worker
// (see playwright.config.ts), so one set of module-level variables is
// enough — there is never more than one test in flight.
let currentDir: string | null = null;
let stepCounter = 0;

/**
 * Opens a fresh per-test screenshot folder and resets the step counter.
 * Called once before each test from the auto fixture in
 * {@link file://./fixtures.ts}.
 */
export const beginTestScreenshots = (titlePath: string[]): void => {
  stepCounter = 0;
  if (!screenshotsEnabled()) {
    currentDir = null;
    return;
  }
  currentDir = resolve(SCREENSHOTS_ROOT, testFolderName(titlePath));
  mkdirSync(currentDir, { recursive: true });
};

/**
 * Clears the active folder once a test ends. Called from the auto
 * fixture's teardown so a later `shot()` from a test that somehow runs
 * without the fixture can never leak into the previous test's folder.
 */
export const endTestScreenshots = (): void => {
  currentDir = null;
};

/**
 * Captures a numbered screenshot of `page` for the current step into the
 * active test's folder, e.g. `03-app-loaded.png`.
 *
 * A no-op when capture is disabled, and never throws: the page may be
 * mid-navigation or already closed, and documentation must never fail
 * the test it is documenting.
 */
export const shot = async (page: Page, label: string): Promise<void> => {
  if (!currentDir) return;
  stepCounter += 1;
  const fileName = `${String(stepCounter).padStart(2, "0")}-${slugify(label)}.png`;
  try {
    await page.screenshot({ path: resolve(currentDir, fileName) });
  } catch {
    // Best-effort: a transient page state is not worth failing the test.
  }
};

/**
 * Runs `body` as a named Playwright step and captures a screenshot of
 * the resulting page state. Use to document an inline workflow step that
 * is not already covered by an instrumented helper.
 */
export const step = async <T>(
  page: Page,
  title: string,
  body: () => Promise<T>,
): Promise<T> =>
  test.step(title, async () => {
    const result = await body();
    await shot(page, title);
    return result;
  });
