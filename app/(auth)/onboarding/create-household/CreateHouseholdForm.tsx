"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createHouseholdAction,
  type CreateHouseholdState,
} from "./actions";

const INITIAL: CreateHouseholdState = { error: null };

export function CreateHouseholdForm() {
  const [state, formAction, pending] = useActionState(
    createHouseholdAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">
          Household name
        </span>
        <Input
          type="text"
          name="name"
          required
          maxLength={80}
          autoFocus
          autoComplete="off"
          placeholder="The Almacin household"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "Creating…" : "Create household"}
      </Button>
    </form>
  );
}
