/**
 * Shared knobs for the e2e suite. URLs, timeout budgets, localStorage keys,
 * and app event names that helpers and specs would otherwise hard-code in
 * multiple places.
 */

/** Boot URLs for the services the suite drives. Must match playwright.config.ts. */
export const URLS = {
  /** Community Solid Server base URL. */
  css: "http://localhost:3001/",
  /** Vite dev server base URL where the app under test is served. */
  app: "http://localhost:5173/",
} as const;

/** Per-test budgets for `test.setTimeout`. */
export const TEST_TIMEOUTS = {
  /** Simple UI-only tests with no pod seeding. */
  short: 120_000,
  /** Tests that seed pod content before driving the UI. */
  medium: 180_000,
  /** Multi-step journeys that re-log in across both users. */
  long: 300_000,
} as const;

/** Per-assertion budgets for `expect(...).toBeVisible` and friends. */
export const UI_TIMEOUTS = {
  /** Fast UI reactions like a toggle or a menu open. */
  short: 15_000,
  /** Round-trips through the auth library or the React layer. */
  medium: 30_000,
  /** Slow surfaces, e.g. the OneDrive Pod browser table waiting on a container load. */
  long: 45_000,
} as const;

/** localStorage keys the app reads, written by helpers that switch shells. */
export const STORAGE_KEYS = {
  /** Active layout preference: `"classic"` or `"onedrive"`. */
  layout: "solid-drive.layout",
  /** OneDrive nav rail state: `"true"` (expanded pane) or `"false"` (icon rail). */
  navRailExpanded: "solid-drive.navRailExpanded",
  /** OneDrive theme preference: `"dark"` (default) or `"light"`. */
  theme: "solid-drive.theme",
} as const;

/** CustomEvent names the app dispatches, fired by helpers driving in-app navigation. */
export const APP_EVENTS = {
  /** Tells App to re-read `STORAGE_KEYS.layout` and re-render the chosen shell. */
  layoutChanged: "solid-drive:layout-changed",
  /** Tells `useViewParam` to re-read the `?view=` query param. */
  viewChanged: "solid-drive:view-changed",
  /** Tells `useNavRailExpanded` to re-read `STORAGE_KEYS.navRailExpanded`. */
  navRailExpandedChanged: "solid-drive:nav-rail-expanded-changed",
  /** Tells `useThemePreference` to re-read `STORAGE_KEYS.theme`. */
  themeChanged: "solid-drive:theme-changed",
} as const;
