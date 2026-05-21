import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 5173;
const CSS_PORT = 3001;

const APP_URL = `http://localhost:${APP_PORT}`;
const CSS_URL = `http://localhost:${CSS_PORT}/`;

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx community-solid-server --port ${CSS_PORT} --baseUrl ${CSS_URL} --seedConfig ./e2e/fixtures/seed.json --loggingLevel warn`,
      url: CSS_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
