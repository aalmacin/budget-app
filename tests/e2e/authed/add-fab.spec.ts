import { test, expect } from "../fixtures";

test.describe("AddFAB — drawer cleanup", () => {
  test("drawer no longer shows Quick Add, Add Expense, or Add Income", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open navigation/i }).click();
    const nav = page.getByRole("dialog", { name: /navigation/i });
    await expect(nav.getByRole("link", { name: "Quick Add" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Add Expense" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Add Income" })).not.toBeVisible();
  });
});

test.describe("AddFAB — Transactions page", () => {
  test("+ FAB is a button (not a link)", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByRole("button", { name: /open add menu/i })).toBeVisible();
  });

  test("tapping + opens popover with three options", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await expect(page.getByRole("link", { name: "Quick Add" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Expense" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Income" })).toBeVisible();
  });

  test("tapping outside closes the popover", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await expect(page.getByRole("link", { name: "Quick Add" })).toBeVisible();
    await page.mouse.click(100, 200);
    await expect(page.getByRole("link", { name: "Quick Add" })).not.toBeVisible();
  });

  test("Quick Add navigates to /quick-add", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await page.getByRole("link", { name: "Quick Add" }).click();
    await expect(page).toHaveURL(/\/quick-add/);
  });

  test("Add Expense navigates to /add", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await page.getByRole("link", { name: "Add Expense" }).click();
    await expect(page).toHaveURL(/\/add/);
  });

  test("Add Income navigates to /add-income", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await page.getByRole("link", { name: "Add Income" }).click();
    await expect(page).toHaveURL(/\/add-income/);
  });
});

test.describe("AddFAB — Dashboard page", () => {
  test("+ FAB on dashboard is a button and opens same popover", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await expect(page.getByRole("link", { name: "Quick Add" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Expense" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Income" })).toBeVisible();
  });
});
