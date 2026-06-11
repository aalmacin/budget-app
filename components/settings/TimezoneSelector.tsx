"use client";

import { useState, useTransition } from "react";
import { setTimezoneAction } from "@/app/(app)/settings/actions";

const TIMEZONES: string[] = Intl.supportedValuesOf("timeZone");

type Props = { current: string };

export function TimezoneSelector({ current }: Props) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleChange = (tz: string) => {
    setValue(tz);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setTimezoneAction(tz);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="mt-1 w-full rounded-lg border border-border bg-canvas text-sm text-ink px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sage disabled:opacity-50"
        aria-label="Timezone"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      {saved && (
        <div className="text-[11px] text-sage mt-1">Saved</div>
      )}
      {error && (
        <div className="text-[11px] text-red-500 mt-1">{error}</div>
      )}
    </div>
  );
}
