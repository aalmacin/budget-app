// 2026-06-06: Recurring checkbox flow on /add.

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

test("Add Expense with Recurring creates a subscription AND the first transaction", async ({ page }) => {
  await signIn(page);
  await page.goto("/add");

  const merchant = `RecurExp-${Date.now()}`;
  await page.locator('input[name="amount_cents_dollars"]').fill("5.55");

  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();

  await page.locator('input[name="notes"]').fill(merchant);

  await page.getByLabel("Recurring").check();
  await expect(page.locator('select[name="cadence"]')).toBeVisible();
  await page.locator('select[name="cadence"]').selectOption("monthly");
  await expect(page.locator('input[name="start_date"]')).toBeVisible();

  await page.getByRole("button", { name: /save expense/i }).click();
  await page.waitForURL(/\/dashboard/);

  // Expense visible.
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });

  // Subscription visible on /recurring-transactions (under All others — next renewal is 1 month out).
  await page.goto("/recurring-transactions");
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Out").first()).toBeVisible();
});
