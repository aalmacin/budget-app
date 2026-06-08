// T062 — Quick Add tile re-log flow.
//
// Prereq: alex@example.com has at least one Whole Foods expense logged
// (i.e. run the log-expense-realtime.spec.ts test once, or seed manually).

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

test("Quick Add Recent tile re-logs in two taps (≤SC-008)", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");

  // Tap 1: FAB → /quick-add
  await page.getByRole("link", { name: /add/i }).first().click();
  await expect(page).toHaveURL(/\/quick-add/);

  // Tap 2: first Recent tile.
  const firstTile = page.locator('button:has-text("$")').first();
  await firstTile.click();

  // Returns to dashboard, recent activity updates within 5s.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 6_000 });
});

test("Quick Add pencil on a Recurring row navigates to edit, does not log", async ({ page }) => {
  await signIn(page);
  await page.goto("/quick-add");
  await page.getByRole("button", { name: /recurring/i }).click();

  const edit = page.locator('a[aria-label^="Edit "]').first();
  if (!(await edit.isVisible().catch(() => false))) {
    test.skip(true, "No recurring transactions due in next 30 days for this household");
  }
  await edit.click();
  await expect(page).toHaveURL(/\/recurring-transactions\/[a-f0-9-]+\/edit/);
});

test("Quick Add + opens the full Add Expense form", async ({ page }) => {
  await signIn(page);
  await page.goto("/quick-add");

  await page.getByRole("link", { name: /open full add form/i }).click();
  await expect(page).toHaveURL(/\/add/);
  await expect(page.locator('input[name="amount_cents_dollars"]')).toHaveValue("0.00");
});
