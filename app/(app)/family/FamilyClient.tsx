"use client";

import { MemberCard, type MemberCardData } from "@/components/family/MemberCard";
import { KidGrid, type KidCardData } from "@/components/family/KidGrid";
import { AddAdultByEmail } from "@/components/family/AddAdultByEmail";
import { AddKidForm } from "@/components/family/AddKidForm";
import { formatCAD } from "@/lib/money";
import {
  addAdultAction,
  addKidAction,
  removeMemberAction,
  updateDisplayNameAction,
} from "./actions";

type Props = {
  adults: MemberCardData[];
  kids: KidCardData[];
  monthSpentOnKidsCents: bigint;
  monthLabel: string;
};

export function FamilyClient({ adults, kids, monthSpentOnKidsCents, monthLabel }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="mx-4 mt-2 rounded-3xl bg-sage text-white p-5 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-white/70">
          Spent on kids · {monthLabel}
        </div>
        <div className="font-mono text-4xl font-medium tracking-tight mt-1">
          {formatCAD(monthSpentOnKidsCents).replace("CA$", "$")}
        </div>
        <div className="text-xs text-white/70 mt-1">{kids.length} kid{kids.length === 1 ? "" : "s"}</div>
      </div>

      <section className="space-y-2">
        <h2 className="px-4 text-[11px] font-mono uppercase tracking-[1.4px] text-muted">Adults</h2>
        <div className="px-4 space-y-2">
          {adults.map((a) => (
            <MemberCard
              key={a.id}
              member={a}
              onSaveDisplayName={(id, name) => updateDisplayNameAction(id, name).then(() => undefined)}
              onRemove={(id) => removeMemberAction(id).then(() => undefined)}
            />
          ))}
        </div>
        <AddAdultByEmail onAdd={addAdultAction} />
      </section>

      <section className="space-y-2">
        <h2 className="px-4 text-[11px] font-mono uppercase tracking-[1.4px] text-muted">Kids</h2>
        <KidGrid kids={kids} onRemove={(id) => removeMemberAction(id).then(() => undefined)} />
        <AddKidForm onAdd={addKidAction} />
      </section>
    </div>
  );
}
