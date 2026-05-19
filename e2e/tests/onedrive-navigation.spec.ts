import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout, navigateToView } from "../helpers/onedrive";
import { TEST_TIMEOUTS } from "../config";

/**
 * Navigating between views in the OneDrive shell. The NavRail writes the
 * active view to `?view=`, OneDriveLayout reads it back to render the view,
 * and the title shows in the page header. These tests check that round trip:
 * rendered view, page title, and the `aria-current` marker.
 *
 * `?view=` is only asserted on People, because My Files' Pod browser writes
 * its own `?folder=` over the URL and drops `?view=`. Deep-link reload
 * survival lives in the useViewParam unit tests.
 */

// The five rail views: the label on the NavRail button, the value the
// view writes into the ?view= param, and a per-view identity assertion.
// My Files and Requests render the standard page-header with an
// `.odl-page-title` heading. Recent, Shared, and People each render
// their own toolbar inline, so the page-header is suppressed and the
// title lives in a view-specific element.
const VIEWS: ReadonlyArray<{
  label: string;
  view: string;
  identityLocator: string;
  identityText: string;
}> = [
  { label: "Home",     view: "recent",   identityLocator: ".odl-recent__heading",       identityText: "Recent" },
  { label: "My Files", view: "my-files", identityLocator: ".odl-page-title",            identityText: "My Files" },
  { label: "Shared",   view: "shared",   identityLocator: "shared-toolbar-tabs",        identityText: "With you" },
  { label: "Requests", view: "requests", identityLocator: ".odl-page-title",            identityText: "Requests" },
  { label: "People",   view: "people",   identityLocator: ".odl-people-list__heading",  identityText: "People" },
];

test("the NavRail switches between all five views", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", "recent");

  for (const { label, view, identityLocator, identityText } of VIEWS) {
    await navigateToView(page, label);
    // Shared takes over the main grid slot and renders without the
    // shared `<main>` wrapper, so only assert it for the other views.
    if (view !== "shared") {
      await expect(page.locator("main.odl-main")).toHaveAttribute("data-view", view);
    }
    await expect(page.locator(identityLocator).first()).toContainText(identityText);
  }

  // People does not touch the URL itself, so the NavRail's ?view= write
  // is still there to assert on.
  await expect(page).toHaveURL(/[?&]view=people/);

  await close();
});

test("the NavRail marks the active view with aria-current", async ({ browser, parni }) => {
  test.setTimeout(TEST_TIMEOUTS.short);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  const myFiles = page.locator("nav-rail").getByRole("button", { name: "My Files", exact: true });
  const shared = page.locator("nav-rail").getByRole("button", { name: "Shared", exact: true });

  await navigateToView(page, "My Files");
  await expect(myFiles).toHaveAttribute("aria-current", "page");
  await expect(shared).not.toHaveAttribute("aria-current", "page");

  await navigateToView(page, "Shared");
  await expect(shared).toHaveAttribute("aria-current", "page");
  await expect(myFiles).not.toHaveAttribute("aria-current", "page");

  await close();
});
