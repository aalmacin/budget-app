// 2026-06-06: subscription "Skip" flow from the home page due card.
// Creates a subscription due today, taps Skip on the dashboard, verifies the
// row is gone AND no transaction was logged.

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

test("Skip advances the subscription with no transaction", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  const merchant = `SkipSub-${Date.now()}`;
  await page.getByRole("button", { name: /add subscription/i }).click();
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.locator('input[type="number"]').first().fill("9.99");
  await page.getByRole("button", { name: /^add subscription$/i }).click();

  await page.goto("/dashboard");
  const dueCard = page.locator("text=Due subscriptions").locator("..");
  await expect(dueCard.getByText(merchant)).toBeVisible({ timeout: 5_000 });

  // Tap Skip for our row.
  const row = dueCard.locator(`li:has-text("${merchant}")`);
  await row.getByRole("button", { name: /skip/i }).click();

  // The row disappears from the due card.
  await expect(dueCard.getByText(merchant)).toHaveCount(0, { timeout: 5_000 });

  // No new transaction with this merchant in Recent activity.
  await expect(page.getByText(merchant)).toHaveCount(0);
});
