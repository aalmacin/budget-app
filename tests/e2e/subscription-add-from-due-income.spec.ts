// 2026-06-06: Add-from-due flow for an INCOME subscription.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ALEX_EMAIL);
  await page.locator('input[name="password"]').fill(ALEX_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Add from a due INCOME subscription routes to AddIncomeForm and saves", async ({ page }) => {
  await signIn(page);
  await page.goto("/add-income");

  const note = `DueIncome-${Date.now()}`;
  await page.locator('input[type="number"]').first().fill("99.00");
  await page.locator('select[name="income_source"]').selectOption("Refund");
  await page.locator('input[name="notes"]').fill(note);
  await page.getByLabel("Recurring").check();
  await page.locator('select[name="cadence"]').selectOption("monthly");
  await page.locator('input[name="start_date"]').fill(isoDaysAgo(31));
  await page.getByRole("button", { name: /save income/i }).click();
  await page.waitForURL(/\/dashboard/);

  // The new sub is due (start was 31 days ago + 1 month ≤ today).
  const dueCard = page.locator("text=Due subscriptions").locator("..");
  await expect(dueCard.getByText(note)).toBeVisible({ timeout: 5_000 });

  await dueCard.getByRole("link", { name: /^Add$/ }).first().click();
  await page.waitForURL(/\/recurring-transactions\/.+\/add/);

  // The form is the income form: it has the Source select.
  await expect(page.locator('select[name="income_source"]')).toBeVisible();

  await page.getByRole("button", { name: /save & advance/i }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(note).first()).toBeVisible({ timeout: 5_000 });
});
