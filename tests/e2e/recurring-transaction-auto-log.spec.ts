// 2026-06-06: Register a recurring expense via /add (Recurring checked),
// then verify pause/resume on /recurring-transactions.

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

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function createRecurringExpense(
  page: Page,
  opts: { merchant: string; amount: string; cadence?: string; startDateIso?: string; intervalDays?: string },
) {
  await page.goto("/add");
  await page.locator('input[name="amount_cents_dollars"]').fill(opts.amount);
  // Pick the first existing category from the combobox.
  const catInput = page.locator('input[placeholder*="category"]').or(
    page.getByRole("combobox").first(),
  );
  await catInput.click();
  const firstCategory = page.getByRole("option").first();
  await firstCategory.click();
  // Merchant (notes).
  await page.locator('input[name="notes"]').fill(opts.merchant);

  // Toggle Recurring.
  await page.getByLabel("Recurring").check();
  if (opts.cadence) {
    await page.locator('select[name="cadence"]').selectOption(opts.cadence);
  }
  if (opts.cadence === "custom_days" && opts.intervalDays) {
    await page.locator('input[name="interval_days"]').fill(opts.intervalDays);
  }
  if (opts.startDateIso) {
    await page.locator('input[name="start_date"]').fill(opts.startDateIso);
  }

  await page.getByRole("button", { name: /save expense/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test("Register a Netflix subscription via Add Expense + Recurring", async ({ page }) => {
  await signIn(page);
  const merchant = `Netflix-${Date.now()}`;
  await createRecurringExpense(page, {
    merchant,
    amount: "19.99",
    cadence: "monthly",
  });
  await page.goto("/recurring-transactions");
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });
  // The first sub in "All others" has a Pause button.
  const pause = page.getByRole("button", { name: /pause/i }).first();
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(page.getByRole("button", { name: /resume/i }).first()).toBeVisible();
});
