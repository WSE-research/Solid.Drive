/**
 * Playwright fixtures for the e2e suite.
 *
 * Each test gets two pre-authenticated users, Peach and Parni, and a
 * clean Peach pod. The fixture takes care of resolving WebIDs from the
 * seed config, authenticating against CSS via client credentials,
 * patching profiles with the triples the app's profile-driven UI needs
 * (pim:storage, foaf:name, ldp:inbox, dcat:catalog), and wiping leftover
 * pod state from previous runs (CSS reuses memory across local test
 * invocations).
 *
 * Tests pull what they need from the destructured fixture argument:
 *
 *   test("...", async ({ peach, parni }) => { ... });
 */

import { test as base, type Browser, type Page } from "@playwright/test";
import { getAuthenticatedFetch } from "./css-auth";
import { cleanPod, ensureProfileBasics, podOf, type PodIdentity } from "./seed";
import { loginAsViaUI } from "./login-ui";
import { beginTestScreenshots, endTestScreenshots } from "./screenshots";

/** CSS account credentials for the seeded pod owner, matching `e2e/fixtures/seed.json`. */
export const PEACH_CREDENTIALS = { email: "peach@e2e.test", password: "peachy" } as const;
/** CSS account credentials for the seeded file requester, matching `e2e/fixtures/seed.json`. */
export const PARNI_CREDENTIALS = { email: "parni@e2e.test", password: "parnitest" } as const;

/** Per-user fixture surface exposed to tests. */
export type UserFixture = {
  /** URI map for this user's pod. */
  pod: PodIdentity;
  /** CSS account email used for the OIDC login flow. */
  email: string;
  /** CSS account password used for the OIDC login flow. */
  password: string;
  /** DPoP-bound fetch authenticated as this user. Use for direct CSS calls. */
  authedFetch: typeof fetch;
};

type TestFixtures = {
  /** Pod owner. Has files seeded by tests; receives access requests. */
  peach: UserFixture;
  /** File requester. Adds Peach as contact and asks for access. */
  parni: UserFixture;
  /**
   * Auto fixture that prepares a fresh `e2e/screenshots/<test-name>/`
   * folder before each test, so the instrumented UI helpers can drop
   * numbered step screenshots into it. Pure side effect; nothing to
   * pull from the destructured fixture argument.
   */
  documentationScreenshots: void;
};

// Playwright's fixture callback is conventionally named `use`. We rename
// it to `provide` so eslint-plugin-react-hooks does not mistake it for
// React's `use()`.
export const test = base.extend<TestFixtures>({
  peach: async ({}, provide) => {
    const pod = podOf("peach");
    const authedFetch = await getAuthenticatedFetch(
      PEACH_CREDENTIALS.email,
      PEACH_CREDENTIALS.password,
      pod.webId,
    );
    await ensureProfileBasics(authedFetch, pod, "Peach");
    await cleanPod(authedFetch, pod);
    await provide({ pod, ...PEACH_CREDENTIALS, authedFetch });
  },

  parni: async ({}, provide) => {
    const pod = podOf("parni");
    const authedFetch = await getAuthenticatedFetch(
      PARNI_CREDENTIALS.email,
      PARNI_CREDENTIALS.password,
      pod.webId,
    );
    await ensureProfileBasics(authedFetch, pod, "Parni");
    await cleanPod(authedFetch, pod);
    await provide({ pod, ...PARNI_CREDENTIALS, authedFetch });
  },

  documentationScreenshots: [
    async ({}, provide) => {
      // `test.info()` is valid inside fixtures and yields the running
      // test, so the folder name tracks the spec file and test title.
      beginTestScreenshots(base.info().titlePath);
      await provide();
      endTestScreenshots();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

type FreshLoginOptions = {
  /**
   * Browser permissions to grant the new context, for example
   * "clipboard-read" and "clipboard-write" for tests that exercise the
   * copy-link action. None are granted by default.
   */
  permissions?: string[];
};

/**
 * Opens a fresh browser context, logs in as the given user, and returns
 * the new page. Use this anywhere a test needs a clean React state, and
 * in particular after the other side approves or revokes. Otherwise the
 * existing context still holds pre-change auth tokens and LDO subject
 * caches, and the UI will not reflect what happened on the server.
 *
 * @param browser - Playwright `Browser` injected from the test fixture
 * @param user - email + password to log in as; pass a `UserFixture` directly
 * @param options - optional context settings such as browser permissions to grant
 * @returns the new `page` and a `close` handler that disposes the context
 */
export async function freshLogin(
  browser: Browser,
  user: Pick<UserFixture, "email" | "password">,
  options?: FreshLoginOptions,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  if (options?.permissions?.length) {
    await context.grantPermissions(options.permissions);
  }
  const page = await context.newPage();
  await loginAsViaUI(page, user.email, user.password);
  return { page, close: () => context.close() };
}
