// 2026-06-06: subscription create flow with cadence=custom_days.
// Verifies the interval-days input only appears when "custom (days)" is
// selected, and that a sub with cadence=custom_days, interval_days=14 saves
// successfully.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ALEX_EMAIL);
  await page.locator('input[name="password"]').fill(ALEX_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Create subscription with custom_days cadence", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  await page.getByRole("button", { name: /add subscription/i }).click();

  // Interval-days input should not be visible yet.
  await expect(page.getByPlaceholder("Interval days")).toHaveCount(0);

  // Pick custom (days).
  const cadenceSelect = page.locator("select").nth(1);
  await cadenceSelect.selectOption("custom_days");

  // Interval-days input now visible, default 30.
  await expect(page.getByPlaceholder("Interval days")).toBeVisible();
  await page.getByPlaceholder("Interval days").fill("14");

  const merchant = `Custom-${Date.now()}`;
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.locator('input[type="number"]').first().fill("5.00");

  await page.getByRole("button", { name: /^add subscription$/i }).click();

  // The new subscription appears in the list.
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });

  // Switch back to monthly — interval-days input should disappear again.
  await page.getByRole("button", { name: /add subscription/i }).click();
  // (The form is reset on close+reopen.)
  await expect(page.getByPlaceholder("Interval days")).toHaveCount(0);
});
