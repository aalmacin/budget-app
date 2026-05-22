import { defineConfig, devices } from "@playwright/test";

const PORT = 3023;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    viewport: { width: 375, height: 812 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
