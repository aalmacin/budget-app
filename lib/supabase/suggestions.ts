import type { SupabaseClient } from "@supabase/supabase-js";
import { uuidSchema } from "@/lib/validators";
import type { ExpensePrefill } from "@/app/(app)/add/AddExpenseForm";

type RawSuggestion = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  occurred_on: string;
  category_id: string | null;
  category_name: string | null;
  default_essential_pct: number | null;
  subscription_id: string | null;
  notes: string;
};

export type SuggestionPrefill = {
  id: string;
  subscriptionId: string | null;
  subtitle: string;
  prefill: ExpensePrefill;
};

/** Loads a pending suggestion for the review form; null if gone or not ours. */
export async function getSuggestionPrefill(
  supabase: SupabaseClient,
  rawId: string,
): Promise<SuggestionPrefill | null> {
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return null;

  const { data } = await supabase.rpc("get_expense_suggestion", { p_id: parsedId.data });
  const row = ((data ?? []) as RawSuggestion[])[0];
  if (!row) return null;

  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    subtitle: row.notes ? `Suggested · ${row.notes}` : "Suggested from email",
    prefill: {
      merchant: row.merchant,
      amount_cents: BigInt(
        typeof row.amount_cents === "string" ? row.amount_cents : Math.trunc(row.amount_cents),
      ),
      category_id: row.category_id ?? "",
      category_name: row.category_name ?? "",
      paid_by_member_id: null,
      for_member_ids: [],
      essential_pct: row.default_essential_pct ?? 100,
      split_rule: null,
      occurred_on: row.occurred_on,
    },
  };
}

/** Returns the form's suggestion_id when it is a well-formed UUID, else null. */
export function readSuggestionId(formData: FormData): string | null {
  const parsed = uuidSchema.safeParse(formData.get("suggestion_id"));
  return parsed.success ? parsed.data : null;
}

/**
 * Marks a reviewed suggestion as accepted after its expense saved. A failure
 * here leaves the suggestion pending; saving again is safe because the
 * expense is written idempotently.
 */
export async function acceptSuggestion(
  supabase: SupabaseClient,
  suggestionId: string,
  transactionId: string,
): Promise<string | null> {
  const { error } = await supabase.rpc("accept_expense_suggestion", {
    p_id: suggestionId,
    p_transaction_id: transactionId,
  });
  return error ? `Expense saved, but clearing the suggestion failed: ${error.message}` : null;
}
