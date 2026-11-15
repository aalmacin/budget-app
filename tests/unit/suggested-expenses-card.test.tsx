import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const dismiss = vi.fn(async (id: string) => {
  void id;
  return {};
});
vi.mock("@/app/(app)/dashboard/actions", () => ({
  dismissExpenseSuggestionAction: (id: string) => dismiss(id),
}));

import {
  SuggestedExpensesCard,
  type SuggestionRow,
} from "@/app/(app)/dashboard/SuggestedExpensesCard";

const plain: SuggestionRow = {
  id: "11111111-1111-4111-8111-111111111111",
  merchant: "Costco",
  amount_cents: 8421n,
  occurred_on: "2026-11-13",
  category_name: "Groceries",
  subscription_id: null,
  subscription_merchant: null,
  notes: "Receipt email",
};

const recurring: SuggestionRow = {
  id: "22222222-2222-4222-8222-222222222222",
  merchant: "Etsy",
  amount_cents: 1435n,
  occurred_on: "2026-11-09",
  category_name: null,
  subscription_id: "33333333-3333-4333-8333-333333333333",
  subscription_merchant: "Etsy",
  notes: "",
};

afterEach(() => {
  cleanup();
  dismiss.mockClear();
});

describe("SuggestedExpensesCard", () => {
  it("shows the count, amounts and category fallback", () => {
    render(<SuggestedExpensesCard rows={[plain, recurring]} />);
    expect(screen.getByText("Suggested expenses · 2")).toBeTruthy();
    expect(screen.getByText("$84.21")).toBeTruthy();
    expect(screen.getByText(/No category · 2026-11-09 · recurring/)).toBeTruthy();
  });

  it("sends plain suggestions to /add and linked ones through the recurring flow", () => {
    render(<SuggestedExpensesCard rows={[plain, recurring]} />);
    const links = screen.getAllByRole("link", { name: "Review" });
    expect(links[0].getAttribute("href")).toBe(`/add?suggestion=${plain.id}`);
    expect(links[1].getAttribute("href")).toBe(
      `/recurring-transactions/${recurring.subscription_id}/add?suggestion=${recurring.id}`,
    );
  });

  it("dismisses the clicked suggestion", async () => {
    render(<SuggestedExpensesCard rows={[plain, recurring]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[1]);
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith(recurring.id));
  });
});
