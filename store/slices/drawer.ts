import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type DrawerState = {
  open: boolean;
};

const initialState: DrawerState = {
  open: false,
};

const drawerSlice = createSlice({
  name: "drawer",
  initialState,
  reducers: {
    open(state) {
      state.open = true;
    },
    close(state) {
      state.open = false;
    },
    toggle(state) {
      state.open = !state.open;
    },
    set(state, action: PayloadAction<boolean>) {
      state.open = action.payload;
    },
  },
});

export const drawerActions = drawerSlice.actions;
export const drawerReducer = drawerSlice.reducer;
