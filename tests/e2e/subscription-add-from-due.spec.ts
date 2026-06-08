// 2026-06-06: subscription "Add" flow from the home page due card.
// Creates a recurring expense via /add (Recurring checkbox) with a start
// date 31 days ago so next_renewal_at falls on or before today and the sub
// shows up in the Due card. Verifies prefill, save, redirect, and that the
// row is gone from the due card afterwards.

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

test("Add from due subscription prefills, saves, and clears the due card", async ({ page }) => {
  await signIn(page);

  const merchant = `DueSub-${Date.now()}`;
  await createRecurringExpense(page, {
    merchant,
    amount: "12.34",
    cadence: "monthly",
    startDateIso: isoDaysAgo(31),
  });

  await page.goto("/dashboard");
  const dueRow = page.locator("text=Due subscriptions").locator("..");
  await expect(dueRow.getByText(merchant)).toBeVisible({ timeout: 5_000 });

  // Tap Add.
  await dueRow.getByRole("link", { name: /^Add$/ }).first().click();
  await page.waitForURL(/\/recurring-transactions\/.+\/add/);

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
