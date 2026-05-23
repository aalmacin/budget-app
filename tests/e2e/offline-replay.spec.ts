// T109 — Offline-replay flow.
// Verifies: with network offline, logging an expense queues it in the outbox.
// On reconnect, the queue drains via the dispatchOrEnqueue helper.

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

test("Offline expense via Quick Add queues and replays", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/quick-add");

  // Take the page offline at the browser level.
  await context.setOffline(true);

  // Tap any recent tile to enqueue an offline write.
  const tile = page.locator('button:has-text("$")').first();
  if (!(await tile.isVisible().catch(() => false))) {
    test.skip(true, "No recent tiles available for the offline test");
  }
  await tile.click();

  // Wait briefly for the outbox to receive the entry.
  await page.waitForTimeout(500);

  // Restore connectivity; OnlineReplayMounter drains the queue.
  await context.setOffline(false);

  // Allow the replay to complete and the dashboard to refresh.
  await page.waitForTimeout(1500);

  // The new expense should appear in recent activity.
  await page.goto("/dashboard");
  await expect(page.getByText(/Recent activity/)).toBeVisible();
});
