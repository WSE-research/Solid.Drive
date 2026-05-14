import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout, navigateToView } from "../helpers/onedrive";

/**
 * Tests for navigating between views in the OneDrive shell.
 *
 * The active view is stored in the `?view=` query param. The NavRail writes
 * that param when a rail button is clicked, OneDriveLayout reads it back to
 * decide which view to render, and it shows the view's title in the page
 * header. These tests click the real rail buttons and check that round
 * trip: the rendered view (via the main panel's data-view attribute), the
 * page title, and the `aria-current` marker on the active rail button.
 *
 * The URL `?view=` param is only asserted on the People view. On My Files,
 * the Pod browser writes its own `?folder=` param over the search string,
 * which drops `?view=` from the URL even though the view itself stays put.
 * That is an integration quirk between the two navigation hooks, not
 * something these view-switching tests should depend on.
 *
 * Note also that a `?view=` deep link does not survive a full page reload:
 * the silent re-auth on reload drops the query string from its redirect
 * URI. The param-reading path is covered by the unit tests in
 * `useViewParam-test` instead.
 */

// The five rail views: the label on the NavRail button, the value the view
// writes into the ?view= param, and the title shown in the page header.
const VIEWS: ReadonlyArray<{ label: string; view: string; title: string }> = [
  { label: "Home",     view: "recent",   title: "Home" },
  { label: "My Files", view: "my-files", title: "My Files" },
  { label: "Shared",   view: "shared",   title: "Shared" },
  { label: "Requests", view: "requests", title: "Requests" },
  { label: "People",   view: "people",   title: "People" },
];

test("the NavRail switches between all five views", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  // The shell opens on the Home view by default.
  await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", "recent");

  // Walk every rail button and confirm it renders its view: the main panel
  // switches its data-view, and the page header shows the view's title.
  for (const { label, view, title } of VIEWS) {
    await navigateToView(page, label);
    await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", view);
    await expect(page.locator(".odl-page-title")).toHaveText(title);
  }

  // The loop ended on People, a view that does not touch the URL itself, so
  // the ?view= param the NavRail wrote is still there to assert on.
  await expect(page).toHaveURL(/[?&]view=people/);

  await close();
});

test("the NavRail marks the active view with aria-current", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  const myFiles = page.locator("nav-rail").getByRole("button", { name: "My Files", exact: true });
  const shared = page.locator("nav-rail").getByRole("button", { name: "Shared", exact: true });

  // Only the button for the active view should carry aria-current="page",
  // and it should move to whichever view was navigated to last.
  await navigateToView(page, "My Files");
  await expect(myFiles).toHaveAttribute("aria-current", "page");
  await expect(shared).not.toHaveAttribute("aria-current", "page");

  await navigateToView(page, "Shared");
  await expect(shared).toHaveAttribute("aria-current", "page");
  await expect(myFiles).not.toHaveAttribute("aria-current", "page");

  await close();
});
