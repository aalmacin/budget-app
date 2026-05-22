"use client";

import { configureStore } from "@reduxjs/toolkit";
import {
  Provider,
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";
import { drawerReducer } from "@/store/slices/drawer";
import { outboxReducer } from "@/store/slices/outbox";

export const store = configureStore({
  reducer: {
    drawer: drawerReducer,
    outbox: outboxReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export { Provider as StoreProvider };
