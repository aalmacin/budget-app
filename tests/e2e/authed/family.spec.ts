import { test, expect } from '../fixtures';

// US5 — family member management.
//
// User A starts each test signed in (via global storageState) and as a
// member of their default household. These tests verify the family page
// surfaces the basics; member-CRUD assertions (adult cap rejection, kid
// add/remove, income update) are deferred to a later spec once an admin
// flow exists for setting up an ephemeral household per test run. That
// flow would unblock truly destructive scenarios (add → remove → re-add,
// cap-trigger validation) without polluting the developer's working
// household.

test.describe('US5 — family page (read-side)', () => {
  test('renders the page chrome and at least one adult', async ({ page }) => {
    await page.goto('/family');
    await expect(page).toHaveURL(/\/family$/);
    await expect(page.getByRole('heading', { name: 'Family' })).toBeVisible();
    // The signed-in user is always present as their household's first adult
    // (T064 — create_household inserts the caller).
    await expect(page.getByText('Adults', { exact: true })).toBeVisible();
    await expect(page.getByText('Kids', { exact: true })).toBeVisible();
  });

  test('the add-adult form is present', async ({ page }) => {
    await page.goto('/family');
    // Heuristic: the AddAdultByEmail component renders an email input.
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
  });
});
