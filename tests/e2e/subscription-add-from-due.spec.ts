// 2026-06-06: subscription "Add" flow from the home page due card.
// Creates a subscription whose next_renewal_at is today so it shows up in
// the Due card. Verifies prefill, save, redirect, and that the row is gone
// from the due card afterwards.

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

test("Add from due subscription prefills, saves, and clears the due card", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  // Create a subscription due today.
  const merchant = `DueSub-${Date.now()}`;
  await page.getByRole("button", { name: /add subscription/i }).click();
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.locator('input[type="number"]').first().fill("12.34");
  // Cadence stays monthly (default). Next renewal stays today (default).
  await page.getByRole("button", { name: /^add subscription$/i }).click();

  // Go to dashboard; the Due card should appear with our row.
  await page.goto("/dashboard");
  const dueRow = page.locator("text=Due subscriptions").locator("..");
  await expect(dueRow.getByText(merchant)).toBeVisible({ timeout: 5_000 });

  // Tap Add.
  await dueRow.getByRole("link", { name: /^Add$/ }).first().click();
  await page.waitForURL(/\/subscriptions\/.+\/add/);

  // Verify prefill: the amount field should show 12.34.
  await expect(page.locator('input[name="amount_cents_dollars"]')).toHaveValue("12.34");

  // Save.
  await page.getByRole("button", { name: /save & advance/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // The merchant appears in Recent activity.
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });

  // The due card no longer shows our row (renewal advanced one month forward).
  const dueCard = page.locator("text=Due subscriptions");
  if (await dueCard.isVisible().catch(() => false)) {
    await expect(dueCard.locator("..").getByText(merchant)).toHaveCount(0);
  }
});
