import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout } from "../helpers/onedrive";
import { TEST_TIMEOUTS, UI_TIMEOUTS } from "../config";

/**
 * Per-view rendering for the OneDrive shell's non-MyFiles views: Recent,
 * Requests, and People. Each of these views renders its own toolbar with
 * an internal heading because OneDriveLayout suppresses the standard
 * page-header for them. The tests assert that toolbar, the empty state
 * for fresh pods, and a small handful of view-specific affordances.
 *
 * MyFiles, Selection, TopBar, and Layout-switch behaviors live in their
 * own specs; Shared coverage is intentionally minimal here because the
 * Classic SharedWithMe section is exercised end-to-end by the sharing
 * specs (full-journey, revoke-keeps-visible, etc.).
 */

test("Recent view renders the toolbar with the empty state for a fresh pod", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "recent");

  // The page-header is suppressed for Recent — the heading lives in the
  // view's own inline toolbar.
  await expect(page.locator(".odl-page-title")).toHaveCount(0);
  await expect(page.locator(".odl-recent__heading")).toHaveText("Recent", {
    timeout: UI_TIMEOUTS.short,
  });

  // The toolbar's filter chips render the catalog-derived type filter
  // and a person-name filter input. A fresh pod has no recent entries,
  // so the empty-state message is what the user sees in the body.
  await expect(page.locator("recent-toolbar")).toBeVisible();
  await expect(page.getByRole("group", { name: "File type filter" })).toBeVisible();
  await expect(page.locator(".odl-filter-input")).toBeVisible();

  await close();
});

test("Requests view renders the empty state and a Refresh control", async ({ browser, peach }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, peach);
  await enterOneDriveLayout(page, "requests");

  // Requests is the only non-MyFiles view that still uses the page-header,
  // so the page title renders.
  await expect(page.locator(".odl-page-title")).toHaveText("Requests", {
    timeout: UI_TIMEOUTS.short,
  });

  // No pending requests on a fresh pod — the list shows the empty title
  // and the Refresh button is wired to re-fetch.
  await expect(page.locator(".odl-requests-list__empty-title")).toHaveText(
    "No pending requests",
    { timeout: UI_TIMEOUTS.medium },
  );
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();

  await close();
});

test("People view renders the inline header, filter input, and add toggle", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "people");

  // People also suppresses the page-header; the heading is the view's own.
  await expect(page.locator(".odl-page-title")).toHaveCount(0);
  await expect(page.locator(".odl-people-list__heading")).toHaveText("People");

  // The header row owns the title, the person-name filter, and the
  // add-contact toggle.
  await expect(page.locator(".odl-people-list__filter")).toBeVisible();
  const addToggle = page.getByRole("button", { name: "Add", exact: true });
  await expect(addToggle).toBeVisible();

  // Clicking the toggle expands the inline add-contact row with a WebID input.
  await addToggle.click();
  await expect(page.locator(".odl-people-list__add-input")).toBeVisible();
  // The submit button is disabled until a non-empty value is entered.
  await expect(
    page.locator(".odl-people-list__add-submit"),
  ).toBeDisabled();

  await close();
});

test("Shared view renders the tablist and switches between With you / By you", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page, "shared");

  // Shared takes over the main grid slot — no page-header, no `main.odl-main`.
  await expect(page.locator(".odl-page-title")).toHaveCount(0);
  await expect(page.locator("main.odl-main")).toHaveCount(0);

  // The toolbar's tablist surfaces both tabs; "With you" is the default.
  const tablist = page.getByRole("tablist", { name: "Shared" });
  await expect(tablist).toBeVisible({ timeout: UI_TIMEOUTS.short });
  const withYou = tablist.getByRole("tab", { name: "With you", exact: true });
  const byYou = tablist.getByRole("tab", { name: "By you", exact: true });
  await expect(withYou).toHaveAttribute("aria-selected", "true");
  await expect(byYou).toHaveAttribute("aria-selected", "false");

  // Activating the other tab flips aria-selected without unmounting the toolbar.
  await byYou.click();
  await expect(byYou).toHaveAttribute("aria-selected", "true");
  await expect(withYou).toHaveAttribute("aria-selected", "false");

  await close();
});
