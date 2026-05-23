"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  onAdd: (name: string, age: number) => Promise<{ error?: string }>;
};

export function AddKidForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 25) {
      setError("Age must be 0–25");
      return;
    }
    startTransition(async () => {
      const result = await onAdd(name, ageNum);
      if (result.error) {
        setError(result.error);
      } else {
        setName("");
        setAge("");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 px-4">
      <label className="text-xs text-muted font-mono uppercase tracking-wider">
        Add kid
      </label>
      <div className="flex gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mia"
          required
        />
        <Input
          type="number"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="Age"
          min={0}
          max={25}
          required
          className="!w-24"
        />
        <Button type="submit" disabled={pending || !name || !age}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-brick">
          {error}
        </p>
      )}
    </form>
  );
}
