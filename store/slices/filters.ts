import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Filter state shared between the Budget overview and the Transactions list. */
export type EssentialFilter = "all" | "essential" | "treats";

type FiltersState = {
  essential: EssentialFilter;
  search: string;
  forMember: string | null;
  categoryId: string | null;
  /** ISO YYYY-MM-DD or null. */
  fromDate: string | null;
  toDate: string | null;
};

/** Current-month bounds [first day, first day of next month) as YYYY-MM-DD.
 * Mirrors FilterChips' "this_month" range so the dropdown reflects the default. */
function thisMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { from: iso(y, m, 1), to: iso(nextY, nextM, 1) };
}

const initialState: FiltersState = {
  essential: "all",
  search: "",
  forMember: null,
  categoryId: null,
  fromDate: thisMonthBounds().from,
  toDate: thisMonthBounds().to,
};

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setEssential(state, action: PayloadAction<EssentialFilter>) {
      state.essential = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setForMember(state, action: PayloadAction<string | null>) {
      state.forMember = action.payload;
    },
    setCategory(state, action: PayloadAction<string | null>) {
      state.categoryId = action.payload;
    },
    setFromDate(state, action: PayloadAction<string | null>) {
      state.fromDate = action.payload;
    },
    setToDate(state, action: PayloadAction<string | null>) {
      state.toDate = action.payload;
    },
    reset() {
      return initialState;
    },
  },
});

export const filtersActions = filtersSlice.actions;
export const filtersReducer = filtersSlice.reducer;
