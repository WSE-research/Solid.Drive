/**
 * Playwright fixtures for the e2e suite.
 *
 * Each test gets two pre-authenticated users (`peach` and `parni`) and a
 * clean Peach pod. This lifts the boilerplate every test would otherwise
 * repeat:
 *
 *   - Resolving WebIDs / URIs from the seed config
 *   - Authenticating against CSS via client-credentials
 *   - Patching profiles with `pim:storage`, `foaf:name`, `ldp:inbox`,
 *     `dcat:catalog` (CSS-seeded profiles ship without these)
 *   - Wiping leftover pod state from previous runs (CSS reuses memory
 *     across `npm run test:e2e` invocations when not in CI)
 *
 * Tests pull what they need from the destructured fixture argument:
 *
 *   test("...", async ({ peach, parni, ... }) => { ... });
 */

import { test as base, type Browser, type Page } from "@playwright/test";
import { getAuthenticatedFetch } from "./css-auth";
import { cleanPod, ensureProfileBasics, podOf, type PodIdentity } from "./seed";
import { loginAsViaUI } from "./login-ui";

export const PEACH_CREDENTIALS = { email: "peach@e2e.test", password: "peachy" } as const;
export const PARNI_CREDENTIALS = { email: "parni@e2e.test", password: "parnitest" } as const;

export type UserFixture = {
  pod: PodIdentity;
  email: string;
  password: string;
  /** DPoP-bound fetch authenticated as this user. Use for direct CSS calls. */
  authedFetch: typeof fetch;
};

type TestFixtures = {
  /** Pod owner. Has files seeded by tests; receives access requests. */
  peach: UserFixture;
  /** File requester. Adds Peach as contact and asks for access. */
  parni: UserFixture;
};

// Playwright passes a callback as the second argument that hands the value
// to the test. Its conventional name is `use`, but we rename it to `provide`
// so eslint-plugin-react-hooks doesn't mistake it for `React.use()`.
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
    await provide({ pod, ...PARNI_CREDENTIALS, authedFetch });
  },
});

export { expect } from "@playwright/test";

/**
 * Opens a fresh browser context, logs in as the given user, and returns the
 * new page. Use this anywhere a test needs a clean React state, in
 * particular **after the other side approves/revokes** — the
 * `solid-client-authn-browser` session storage and LDO subject cache
 * otherwise hold the pre-change ACL state and the UI won't reflect what
 * happened on the server.
 */
export async function freshLogin(
  browser: Browser,
  user: Pick<UserFixture, "email" | "password">,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsViaUI(page, user.email, user.password);
  return { page, close: () => context.close() };
}
