/**
 * T034 — Soft-delete a household member (FR-007a, spec clarification §1)
 *
 * Covers:
 *   - Soft-deleting a kid via the Family screen (Remove button on member card)
 *   - Deleted member disappears from the Family grid
 *   - Deleted member disappears from "for whom" filter chips (Transactions screen)
 *   - Deleted member disappears from the new-transaction "for whom" selector
 *   - Historical transactions that referenced the deleted kid still show their name
 *     in the per-person report / transactions list (preserved attribution)
 *
 * Pages: /login (T043), /family (T078/T079), /transactions (FR-021),
 *        new-transaction sheet (FR-008)
 *
 * Pre-condition: Alex is signed in with a household. A kid named "Mia" is added
 * at the start of each test run and then soft-deleted. A transaction tagged for
 * Mia is logged first so the historical-attribution assertion has data.
 */

import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";

const ALEX = {
  email: "alex@example.com",
  password: process.env.E2E_ALEX_PASSWORD ?? "TestPass1!",
};

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', ALEX.email);
  await page.fill('input[name="password"]', ALEX.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/(dashboard|onboarding\/create-household)/, {
    timeout: 10000,
  });
  if (page.url().includes("onboarding")) {
    await page.fill('input[name="householdName"]', `The ${Date.now()} household`);
    await page.getByRole("button", { name: /create household/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  }
}

async function openFamily(page: Page): Promise<void> {
  await page.getByRole("button", { name: /menu|open navigation/i }).click();
  await page.getByRole("link", { name: /family/i }).click();
  await expect(page).toHaveURL(/\/family/, { timeout: 8000 });
}

/** Adds a kid with a unique name and returns the name used. */
async function addKid(page: Page, name: string, age: number): Promise<void> {
  await openFamily(page);
  await page.getByRole("button", { name: /add kid/i }).click();
  await page.fill('input[name="kidName"]', name);
  await page.fill('input[name="kidAge"]', String(age));
  await page.getByRole("button", { name: /^(save|add|create)/i }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 8000 });
}

test.describe("Soft-delete a household member", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let kidName: string;

  test.beforeEach(async ({ browser: b }) => {
    browser = b;
    context = await browser.newContext({ storageState: undefined });
    page = await context.newPage();

    await signIn(page);

    // Use a unique kid name per run so tests don't conflict with prior data
    kidName = `Mia-${Date.now()}`;
    await addKid(page, kidName, 8);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("deleted kid disappears from Family grid, for-whom chips, and new-transaction selector", async () => {
    // Step 1: confirm kid is visible on Family screen
    await openFamily(page);
    await expect(page.getByText(kidName)).toBeVisible();

    // Step 2: soft-delete the kid
    const kidCard = page.getByText(kidName).locator("xpath=ancestor::*[contains(@data-testid,'member-card') or self::li or self::article][1]");
    // Fallback: find Remove button near the kid's name
    const removeButton = page
      .getByText(kidName)
      .locator("..")
      .getByRole("button", { name: /remove/i });
    await removeButton.click();

    // Confirm dialog if present
    const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Step 3: kid card is gone from Family grid
    await expect(page.getByText(kidName)).not.toBeVisible({ timeout: 8000 });

    // Step 4: verify kid absent from "for whom" filter chips on Transactions screen
    await page.getByRole("button", { name: /menu|open navigation/i }).click();
    await page.getByRole("link", { name: /transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 8000 });
    await expect(page.getByRole("button", { name: new RegExp(kidName, "i") })).not.toBeAttached();

    // Step 5: verify kid absent from new-transaction "for whom" selector
    await page.goto("/dashboard");
    // Open add-expense (FAB or quick-add then "+")
    await page.getByRole("button", { name: /\+|add expense|quick add/i }).click();
    // If quick-add screen, tap "+"
    const fullFormButton = page.getByRole("button", { name: /\+/i });
    if (await fullFormButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fullFormButton.click();
    }
    // "For whom" selector should not contain the soft-deleted kid
    await expect(
      page.getByRole("option", { name: new RegExp(kidName, "i") })
    ).not.toBeAttached({ timeout: 5000 });
    // Also check chip/button form if rendered as chips
    await expect(
      page.getByRole("button", { name: new RegExp(kidName, "i") })
    ).not.toBeAttached();
  });

  test("historical transactions for deleted kid still show their name in reports", async () => {
    // Step 1: log a transaction tagged for the kid before deleting them
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /\+|add expense|quick add/i }).click();
    const fullFormButton = page.getByRole("button", { name: /\+/i });
    if (await fullFormButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fullFormButton.click();
    }

    await page.fill('input[name="amount"]', "25.00");

    // Select category
    const categoryField = page.getByRole("combobox", { name: /category/i });
    if (await categoryField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categoryField.selectOption({ label: "Groceries" });
    }

    // Tag the expense for the kid — look for chip or select
    const kidChip = page.getByRole("button", { name: new RegExp(kidName, "i") });
    if (await kidChip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await kidChip.click();
    } else {
      const forWhomSelect = page.getByRole("combobox", { name: /for whom/i });
      await forWhomSelect.selectOption({ label: kidName });
    }

    await page.getByRole("button", { name: /^(save|add|log)/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Step 2: soft-delete the kid
    await openFamily(page);
    const removeButton = page
      .getByText(kidName)
      .locator("..")
      .getByRole("button", { name: /remove/i });
    await removeButton.click();
    const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await expect(page.getByText(kidName)).not.toBeVisible({ timeout: 8000 });

    // Step 3: open transactions list and verify the historical entry still names the kid
    await page.getByRole("button", { name: /menu|open navigation/i }).click();
    await page.getByRole("link", { name: /transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 8000 });

    // The kid's name must still appear on the historical transaction row
    await expect(page.getByText(kidName)).toBeVisible({ timeout: 8000 });
  });
});
