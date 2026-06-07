// 2026-06-06: subscription create flow with cadence=custom_days via /add.
// Verifies that creating a recurring expense with custom_days/14 surfaces
// the sub on /subscriptions, and that the legacy "Add subscription" button
// no longer exists on /subscriptions.

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

test("Create subscription with custom_days cadence", async ({ page }) => {
  await signIn(page);

  const merchant = `Custom-${Date.now()}`;
  await createRecurringExpense(page, {
    merchant,
    amount: "5.00",
    cadence: "custom_days",
    intervalDays: "14",
  });

  // The new subscription appears on /subscriptions (under All others —
  // next_renewal_at is today + 14 days).
  await page.goto("/subscriptions");
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });
});

test("No \"Add subscription\" button on /subscriptions", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");
  await expect(page.getByRole("button", { name: /add subscription/i })).toHaveCount(0);
});
