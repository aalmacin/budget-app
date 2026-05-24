import { defineConfig, devices } from "@playwright/test";

const PORT = 3023;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Pre-signs-in user A and writes session cookies to tests/e2e/.auth/userA.json.
  globalSetup: "./tests/e2e/global-setup",
  projects: [
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /anonymous\/.*\.spec\.ts$/,
    },
    {
      name: "authed-userA",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/userA.json",
      },
      testMatch: /authed\/.*\.spec\.ts$/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
