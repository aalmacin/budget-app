import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./server";

// Cache tag builders — household-scoped to prevent cross-household over-invalidation
export const finTag = (id: string) => `hh:${id}:fin`;
export const txnTag = (id: string) => `hh:${id}:txn`;
export const catTag = (id: string) => `hh:${id}:cat`;
export const mbrTag = (id: string) => `hh:${id}:mbr`;
export const mchTag = (id: string) => `hh:${id}:mch`;
export const recTag = (id: string) => `hh:${id}:rec`;
export const bgtTag = (id: string) => `hh:${id}:bgt`;
export const qaTag = (id: string) => `hh:${id}:qa`;

// Per-request memoization — deduplicates get_current_household within a single render pass
export const getCurrentHousehold = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_current_household");
  return (data as string | null) ?? null;
});

// Per-request memoization — reads the access token once per render pass.
// Called OUTSIDE unstable_cache callbacks so cookies() is allowed.
const getJwt = cache(async (): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
});

// Creates a Supabase client from a JWT without calling cookies().
// Safe to use inside unstable_cache callbacks.
function createBearerClient(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    },
  );
}

// --- Finance data (30s TTL + tag invalidation on write) ---

export async function cachedDashboardSummary(id: string, year: number, month: number) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("get_dashboard_summary", { p_year: year, p_month: month });
      return data;
    },
    [`ds:${id}:${year}:${month}`],
    { tags: [finTag(id)], revalidate: 30 },
  )();
}

export async function cachedDueSubscriptions(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_due_subscriptions");
      return data ?? [];
    },
    [`due:${id}`],
    { tags: [recTag(id), finTag(id)], revalidate: 30 },
  )();
}

export async function cachedListTransactions(id: string, filters: Record<string, unknown>) {
  const jwt = await getJwt();
  const filtersKey = JSON.stringify(filters);
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_transactions", { p_filters: filters });
      return data ?? [];
    },
    [`txn:${id}:${filtersKey}`],
    { tags: [txnTag(id)], revalidate: 30 },
  )();
}

export async function cachedHistoryMonthTransactions(id: string, year: number, month: number) {
  const jwt = await getJwt();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_transactions", {
        p_filters: { from: monthStart, to: monthEnd, limit: 1000 },
      });
      return data ?? [];
    },
    [`txn-hist:${id}:${year}:${month}`],
    { tags: [txnTag(id)], revalidate: 30 },
  )();
}

export async function cachedBudgetProgress(id: string, year: number, month: number, filter: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("get_budget_progress", {
        p_year: year,
        p_month: month,
        p_filter: filter,
      });
      return data ?? [];
    },
    [`bgt:${id}:${year}:${month}:${filter}`],
    { tags: [bgtTag(id), finTag(id)], revalidate: 30 },
  )();
}

export async function cachedMonthlyExpenseComparison(id: string, today: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("monthly_expense_comparison", { p_today: today });
      return data ?? [];
    },
    [`mec:${id}:${today}`],
    { tags: [finTag(id)], revalidate: 30 },
  )();
}

export async function cachedSpendOverTime(id: string, range: string, today: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("spend_over_time", { p_range: range, p_today: today });
      return data ?? [];
    },
    [`sot:${id}:${range}:${today}`],
    { tags: [finTag(id)], revalidate: 30 },
  )();
}

export async function cachedCashflowKpis(id: string, range: string, today: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("cashflow_kpis", { p_range: range, p_today: today });
      return data ?? {};
    },
    [`cf:${id}:${range}:${today}`],
    { tags: [finTag(id)], revalidate: 30 },
  )();
}

export async function cachedEssentialsBreakdown(id: string, year: number, month: number) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("essentials_breakdown", { p_year: year, p_month: month });
      return data ?? {};
    },
    [`ess:${id}:${year}:${month}`],
    { tags: [finTag(id), recTag(id)], revalidate: 30 },
  )();
}

export async function cachedPerPersonBreakdown(id: string, year: number, month: number) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("per_person_breakdown", {
        p_year: year,
        p_month: month,
        p_include_general: false,
      });
      return data ?? [];
    },
    [`pp:${id}:${year}:${month}`],
    { tags: [finTag(id), mbrTag(id)], revalidate: 30 },
  )();
}

export async function cachedComputeIncomeSplit(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("compute_income_split", { p_household_id: id });
      return data ?? [];
    },
    [`split:${id}`],
    { tags: [mbrTag(id), finTag(id)], revalidate: 30 },
  )();
}

// --- Recurring subscriptions (30s TTL) ---

export async function cachedListSubscriptions(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_subscriptions");
      return data ?? [];
    },
    [`sub:${id}`],
    { tags: [recTag(id)], revalidate: 30 },
  )();
}

export async function cachedListUpcomingSubscriptions(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_upcoming_subscriptions");
      return data ?? [];
    },
    [`upc:${id}`],
    { tags: [recTag(id)], revalidate: 30 },
  )();
}

export async function cachedListOverlappingSubscriptions(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_overlapping_subscriptions");
      return data ?? [];
    },
    [`ovl:${id}`],
    { tags: [recTag(id)], revalidate: 30 },
  )();
}

// --- Stable reference data (no TTL — only invalidated by explicit writes) ---

export async function cachedListMembers(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_household_members");
      return data ?? [];
    },
    [`mbr:${id}`],
    { tags: [mbrTag(id)] },
  )();
}

export async function cachedListCategories(id: string, kind: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_categories", { p_kind: kind });
      return data ?? [];
    },
    [`cat:${id}:${kind}`],
    { tags: [catTag(id)] },
  )();
}

export async function cachedListMerchants(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_merchants");
      return data ?? [];
    },
    [`mch:${id}`],
    { tags: [mchTag(id)] },
  )();
}

export async function cachedListSavedExpenses(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_saved_expenses");
      return data ?? [];
    },
    [`qa:${id}`],
    { tags: [qaTag(id)] },
  )();
}

export async function cachedListQuickAddOptions(id: string, limit: number) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_quick_add_options", { p_limit: limit });
      return data ?? [];
    },
    [`qao:${id}:${limit}`],
    { tags: [qaTag(id), recTag(id)] },
  )();
}

export async function cachedHouseholdTimezone(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("get_household_timezone");
      return (data as string | null) ?? "UTC";
    },
    [`tz:${id}`],
    { tags: [mbrTag(id)] },
  )();
}

// --- History months (30s TTL, lightweight alternative to monthly_expense_comparison) ---

export async function cachedListHistoryMonths(id: string) {
  const jwt = await getJwt();
  return unstable_cache(
    async () => {
      const supabase = createBearerClient(jwt);
      const { data } = await supabase.rpc("list_history_months");
      return data ?? [];
    },
    [`hist:${id}`],
    { tags: [finTag(id)], revalidate: 30 },
  )();
}
