// 2026-06-06: Recurring checkbox flow on /add-income.

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

test("Add Income with Recurring creates an income subscription", async ({ page }) => {
  await signIn(page);
  await page.goto("/add-income");

  const note = `RecurInc-${Date.now()}`;
  await page.locator('input[type="number"]').first().fill("1500.00");
  // Earner is the first adult by default — leave as-is.
  await page.locator('select[name="income_source"]').selectOption("Salary");
  await page.locator('input[name="notes"]').fill(note);

  await page.getByLabel("Recurring").check();
  await page.locator('select[name="cadence"]').selectOption("monthly");

  await page.getByRole("button", { name: /save income/i }).click();
  await page.waitForURL(/\/dashboard/);

  await expect(page.getByText(note).first()).toBeVisible({ timeout: 5_000 });

  await page.goto("/subscriptions");
  await expect(page.getByText(note)).toBeVisible({ timeout: 5_000 });
  // Income pill present.
  await expect(page.getByText("In").first()).toBeVisible();
});
