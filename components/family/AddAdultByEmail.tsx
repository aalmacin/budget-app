"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  onAdd: (email: string) => Promise<{ status?: string; error?: string }>;
};

export function AddAdultByEmail({ onAdd }: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await onAdd(email);
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(
          result.status === "inserted"
            ? "Adult added."
            : result.status === "already_member"
              ? "Already a member."
              : result.status === "self_member"
                ? "That's you."
                : "Done.",
        );
        setEmail("");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 px-4">
      <label className="text-xs text-muted font-mono uppercase tracking-wider">
        Add adult by email
      </label>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="bea@example.com"
          required
        />
        <Button type="submit" disabled={pending || !email}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-brick">
          {error}
        </p>
      )}
      {message && <p className="text-xs text-sage">{message}</p>}
    </form>
  );
}
