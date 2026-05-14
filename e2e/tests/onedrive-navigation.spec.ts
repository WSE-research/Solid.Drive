import { test, expect, freshLogin } from "../helpers/fixtures";
import { enterOneDriveLayout, navigateToView } from "../helpers/onedrive";

/**
 * Tests for navigating between views in the OneDrive shell.
 *
 * The active view is stored in the `?view=` query param. The NavRail writes
 * that param when a rail button is clicked, and the main panel reads it back
 * to decide which view to render. These tests click the real rail buttons
 * and check the full round trip: the rendered view, the URL, and the
 * `aria-current` marker on the active rail button.
 *
 * Note that a `?view=` deep link does not survive a full page reload. The
 * silent re-auth that runs on reload drops the query string from its
 * redirect URI, so the param is lost. That is a limitation of the auth
 * layer rather than something these tests can cover, so the param-reading
 * path is covered by the unit tests in `useViewParam-test` instead.
 */

// The five rail views, each with the label shown on its NavRail button, the
// value it writes into the ?view= param, and the test id of its rendered view.
const VIEWS: ReadonlyArray<{ label: string; param: string; testId: string }> = [
  { label: "Home",      param: "recent",   testId: "view-recent" },
  { label: "My Files",  param: "my-files", testId: "view-my-files" },
  { label: "Shared",    param: "shared",   testId: "view-shared" },
  { label: "Requests",  param: "requests", testId: "view-requests" },
  { label: "People",    param: "people",   testId: "view-people" },
];

test("the NavRail switches between all five views and reflects each in the URL", async ({ browser, parni }) => {
  test.setTimeout(120_000);

  const { page, close } = await freshLogin(browser, parni);
  await enterOneDriveLayout(page);

  // The shell opens on the Home view (the "recent" view id) by default.
  await expect(page.getByTestId("view-recent")).toBeVisible();

  // Walk every rail button and confirm each one renders its view and writes
  // its own value into the ?view= query param.
  for (const { label, param, testId } of VIEWS) {
    await navigateToView(page, label);
    await expect(page).toHaveURL(new RegExp(`[?&]view=${param}`));
    await expect(page.getByTestId(testId)).toBeVisible();
  }

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
