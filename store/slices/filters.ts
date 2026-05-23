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

const initialState: FiltersState = {
  essential: "all",
  search: "",
  forMember: null,
  categoryId: null,
  fromDate: null,
  toDate: null,
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
