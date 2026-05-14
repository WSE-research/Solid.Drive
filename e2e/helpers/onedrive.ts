import { expect, type Page } from "@playwright/test";

/**
 * Helpers for driving the OneDrive layout in e2e tests.
 *
 * The layout choice lives in localStorage under the `solid-drive.layout`
 * key, and the active view lives in the `?view=` query param. The helpers
 * here set both the same way the app's own hooks do, so a test can switch
 * into the OneDrive shell in a single line.
 */

/**
 * One of the five OneDriveLayout views. Kept in sync with the `ViewId` type
 * in the app's `useViewParam` hook.
 */
export type ViewId = "recent" | "my-files" | "shared" | "requests" | "people";

/**
 * Switches an already-authenticated page into the OneDrive shell, and
 * optionally navigates straight to one of its views.
 *
 * The switch is done in-page, by writing localStorage and dispatching the
 * app's own events, rather than by reloading. A reload would drop the live
 * Solid session, which leaves every profile-backed part of the UI empty.
 *
 * The helper first waits for the Classic shell's logged-in marker. That
 * marker only appears once login has fully settled, including the URL
 * cleanup the auth library runs after its redirect. Without that wait, the
 * cleanup can run at the same time as the layout switch and undo it.
 *
 * The `?view=` param is written only after the shell has mounted, so the
 * `view-changed` event lands on a listener that is already active. This is
 * the same path a real NavRail click takes.
 */
export async function enterOneDriveLayout(page: Page, view?: ViewId): Promise<void> {
  await expect(page.locator("auth-logged-in")).toBeVisible({ timeout: 30_000 });
  // Persist the layout preference and tell the app's hook it changed, the
  // same way the LayoutToggle does. This re-renders App into the OneDrive
  // shell without a navigation.
  await page.evaluate(() => {
    localStorage.setItem("solid-drive.layout", "onedrive");
    window.dispatchEvent(new CustomEvent("solid-drive:layout-changed"));
  });
  await expect(page.getByTestId("onedrive-layout-root")).toBeVisible({ timeout: 30_000 });

  // Now that the shell is mounted, write the requested view into the URL and
  // tell useViewParam to re-read it. This mirrors what a NavRail click does.
  if (view) {
    await page.evaluate((nextView) => {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextView);
      window.history.replaceState({}, "", url);
      window.dispatchEvent(new CustomEvent("solid-drive:view-changed"));
    }, view);
  }
}

/**
 * Clicks a view button in the NavRail, found by its visible label such as
 * "My Files" or "Shared". This is the in-app way to change the active view.
 */
export async function navigateToView(page: Page, label: string): Promise<void> {
  await page.locator("nav-rail").getByRole("button", { name: label, exact: true }).click();
}

/**
 * Switches into the OneDrive shell on the My Files view and waits for the
 * Pod browser's file table to render. The table only appears once the view
 * has connected to the Pod and loaded the current container, so this gives
 * it a generous timeout.
 */
export async function openMyFiles(page: Page): Promise<void> {
  await enterOneDriveLayout(page, "my-files");
  await expect(page.locator(".odl-files-table")).toBeVisible({ timeout: 45_000 });
}
