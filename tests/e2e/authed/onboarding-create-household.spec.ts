import { test, expect } from '../fixtures';

// US4 — household onboarding.
//
// User A's storage state (set up by global-setup) assumes user A is already
// signed in. After the first time these tests run against a fresh database,
// user A also has a household (one was created either through a prior
// `/onboarding/create-household` submission or via T064's create_household
// RPC during seed). These tests therefore cover the "user has a household"
// branch — the redirect-out path — which is the property the AppLayout gate
// (FR-021) is enforcing.
//
// The "user has NO household" branch (a brand-new account submitting the
// form and landing on /dashboard) requires a fresh user with no membership,
// which can't be set up from a test alone — it needs an admin-provisioned
// user without a `budget.household_member` row. Add that test once an admin
// workflow for ephemeral test users exists.

test.describe('US4 — household onboarding (already-onboarded path)', () => {
  test('visiting /dashboard succeeds when the user has a household', async ({ page }) => {
    // The (app)/layout.tsx gate calls budget.get_current_household; a non-null
    // result lets the dashboard render. A null result would redirect to
    // /onboarding/create-household, which is the un-onboarded path we don't
    // cover yet.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('visiting /onboarding/create-household redirects to /dashboard', async ({ page }) => {
    await page.goto('/onboarding/create-household');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
