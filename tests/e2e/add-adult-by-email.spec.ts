/**
 * T033 — Add adult by email on the Family screen (FR-004, FR-004b)
 *
 * Covers all four outcomes of the add_adult_by_email RPC:
 *   (a) success: new user attached → status `inserted`, visible on Family screen
 *   (b) unknown email → error "No account exists for that email — ask the admin to create one first"
 *   (c) already a member (idempotent re-add) → `already_member`, silent success, no duplicate card
 *   (d) third adult attempt when household already has 2 active adults → error "Households are limited to 2 adults"
 *
 * Pages: /login (T043), /family (T078/T079)
 *
 * Pre-condition: alex@example.com has an active household with exactly 1 adult
 * (themselves). Each test that mutates state uses a unique household name so
 * parallel runs don't collide — but note the 2-adult cap test depends on the
 * household already having Bea added, so the (d) case signs in after (a)/(c).
 *
 * Note: test (a) adds Bea to Alex's household. Subsequent runs will see case (c)
 * (already_member). On a fresh DB, tests run in the order (b) → (a) → (c) → (d).
 */

import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";

const ALEX = {
  email: "alex@example.com",
  password: process.env.E2E_ALEX_PASSWORD ?? "TestPass1!",
};

const BEA_EMAIL = "bea@example.com";
const UNKNOWN_EMAIL = "nobody-nonexistent-99999@example.com";

async function signInAsAlex(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', ALEX.email);
  await page.fill('input[name="password"]', ALEX.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/(dashboard|onboarding\/create-household)/, {
    timeout: 10000,
  });

  // If routed to onboarding, create a household first
  if (page.url().includes("onboarding")) {
    await page.fill('input[name="householdName"]', `The ${Date.now()} household`);
    await page.getByRole("button", { name: /create household/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  }
}

async function navigateToFamily(page: Page): Promise<void> {
  await page.getByRole("button", { name: /menu|open navigation/i }).click();
  await page.getByRole("link", { name: /family/i }).click();
  await expect(page).toHaveURL(/\/family/, { timeout: 8000 });
}

test.describe("Add adult by email", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser: b }) => {
    browser = b;
    context = await browser.newContext({ storageState: undefined });
    page = await context.newPage();
    await signInAsAlex(page);
    await navigateToFamily(page);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("(b) unknown email shows user-visible error and creates no member row", async () => {
    await page.fill('input[name="adultEmail"]', UNKNOWN_EMAIL);
    await page.getByRole("button", { name: /add adult/i }).click();

    await expect(
      page.getByText(/No account exists for that email — ask the admin to create one first/i)
    ).toBeVisible({ timeout: 8000 });

    // No new member card should appear for this email
    await expect(page.getByText(UNKNOWN_EMAIL)).not.toBeVisible();
  });

  test("(a) valid email adds Bea as second adult and member card appears", async () => {
    await page.fill('input[name="adultEmail"]', BEA_EMAIL);
    await page.getByRole("button", { name: /add adult/i }).click();

    // After inserted or already_member, form clears and Bea's card is visible
    await expect(page.getByText(BEA_EMAIL)).toBeVisible({ timeout: 10000 });

    // No error message for the success path
    await expect(
      page.getByText(/No account exists for that email/i)
    ).not.toBeVisible();
    await expect(
      page.getByText(/Households are limited to 2 adults/i)
    ).not.toBeVisible();
  });

  test("(c) re-adding Bea (already_member) is a silent success — no duplicate card", async () => {
    // Attempt to add Bea again (idempotent, FR-004b)
    await page.fill('input[name="adultEmail"]', BEA_EMAIL);
    await page.getByRole("button", { name: /add adult/i }).click();

    // No error shown
    await expect(
      page.getByText(/No account exists for that email/i)
    ).not.toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText(/Households are limited to 2 adults/i)
    ).not.toBeVisible();

    // Exactly one card for Bea's email (no duplicate)
    const beaCards = page.getByText(BEA_EMAIL);
    await expect(beaCards).toHaveCount(1, { timeout: 8000 });
  });

  test("(d) adding a third active adult is rejected with 2-adult cap error", async () => {
    // At this point the household has Alex + Bea (2 active adults).
    // Attempting to add any new email (that exists) triggers the cap check.
    // We use Alex's own email as a known-existing account that is NOT yet a
    // member of this household as a third user — but since v1 pre-provisions
    // only Alex and Bea, we use a workaround: try adding an email that IS in
    // auth.users but isn't in this household.
    // The error is the same regardless of which email triggers it.
    // We use a placeholder third-user email that the quickstart pre-provisions.
    const THIRD_EMAIL = process.env.E2E_THIRD_USER_EMAIL ?? "third@example.com";

    await page.fill('input[name="adultEmail"]', THIRD_EMAIL);
    await page.getByRole("button", { name: /add adult/i }).click();

    await expect(
      page.getByText(/Households are limited to 2 adults/i)
    ).toBeVisible({ timeout: 8000 });
  });
});
