import { expect, type Page } from "@playwright/test";
import { APP_EVENTS, STORAGE_KEYS, UI_TIMEOUTS } from "../config";

/** One of the five OneDriveLayout views. Mirrors `ViewId` in useViewParam. */
export type ViewId = "recent" | "my-files" | "shared" | "requests" | "people";

/**
 * Switches an already-authenticated page into the OneDrive shell and
 * optionally navigates to one of its views. The switch is in-page rather
 * than a reload, so the live Solid session and its profile-backed UI
 * survive.
 *
 * Waits for the Classic logged-in marker first; otherwise the auth library's
 * post-redirect URL cleanup can race the layout switch and undo it. The
 * `?view=` write happens after the OneDrive shell mounts so the dispatched
 * event lands on a live listener.
 *
 * @param page - Playwright page; must already be past the login redirect
 * @param view - optional starting view; omit to land on the default Home view
 */
export async function enterOneDriveLayout(page: Page, view?: ViewId): Promise<void> {
  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: UI_TIMEOUTS.medium });
  await page.evaluate(
    ({ layoutKey, layoutChanged }) => {
      localStorage.setItem(layoutKey, "onedrive");
      window.dispatchEvent(new CustomEvent(layoutChanged));
    },
    { layoutKey: STORAGE_KEYS.layout, layoutChanged: APP_EVENTS.layoutChanged },
  );
  await expect(page.getByTestId("onedrive-layout-root")).toBeVisible({ timeout: UI_TIMEOUTS.medium });

  if (view) {
    await page.evaluate(
      ({ nextView, viewChanged }) => {
        const url = new URL(window.location.href);
        url.searchParams.set("view", nextView);
        window.history.replaceState({}, "", url);
        window.dispatchEvent(new CustomEvent(viewChanged));
      },
      { nextView: view, viewChanged: APP_EVENTS.viewChanged },
    );
  }
}

/**
 * Clicks a NavRail view button by its visible label, e.g. "My Files" or "Shared".
 *
 * @param page - Playwright page, already in the OneDrive shell
 * @param label - the button's visible label; language-sensitive, must match the active locale
 */
export async function navigateToView(page: Page, label: string): Promise<void> {
  await page.locator("nav-rail").getByRole("button", { name: label, exact: true }).click();
}

/**
 * Switches into the OneDrive shell on My Files and waits for the Pod browser
 * table. The table only mounts once the view has loaded the current
 * container, so this uses a generous timeout.
 *
 * @param page - Playwright page; must already be past the login redirect
 */
export async function openMyFiles(page: Page): Promise<void> {
  await enterOneDriveLayout(page, "my-files");
  await expect(page.locator(".odl-files-table")).toBeVisible({ timeout: UI_TIMEOUTS.long });
}
