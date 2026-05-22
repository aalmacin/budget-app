"use client";

import type { ReactNode } from "react";
import { StoreProvider, store } from "@/store";

export function ReduxProvider({ children }: { children: ReactNode }) {
  return <StoreProvider store={store}>{children}</StoreProvider>;
}
