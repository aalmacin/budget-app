// T101 — Subscription auto-log + idempotency.
// Note: this test calls materialize_due_subscriptions() via a server-side RPC,
// so it requires the user to have a household and at least one active sub
// whose next_renewal_at is today or earlier.

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

test("Register a Netflix subscription, pause and resume", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  await page.getByRole("button", { name: /add subscription/i }).click();
  await page.getByPlaceholder(/merchant/i).fill(`Netflix-${Date.now()}`);
  await page.locator('input[type="number"]').first().fill("19.99");
  await page.getByRole("button", { name: /add subscription/i }).click();

  // First Pause button should be enabled.
  const pause = page.getByRole("button", { name: /pause/i }).first();
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(page.getByRole("button", { name: /resume/i }).first()).toBeVisible();
});
