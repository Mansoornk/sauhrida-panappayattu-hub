import type { ReactNode } from "react";
import { Crown, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Member, PayattEvent } from "@/lib/queries";
import {
  deskLabel,
  formatINR,
  formatMonth,
  departmentLabel,
  SELECTION_LABELS,
  type SelectionType,
} from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

export function SelectionBadge({ type }: { type: string }) {
  const t = (type === "lottery" ? "lottery" : "priority") as SelectionType;
  return (
    <Badge variant={t === "lottery" ? "gold" : "success"} className="gap-1">
      {t === "lottery" ? <Crown className="size-3" /> : <HeartPulse className="size-3" />}
      {SELECTION_LABELS[t].en} · <span className="font-ml">{SELECTION_LABELS[t].ml}</span>
    </Badge>
  );
}

/** One recipient's Payattu: who, how they were selected, and what they collected. */
export function EventCard({
  event,
  recipient,
  total,
  contributors,
  action,
  emptyText,
}: {
  event: PayattEvent;
  recipient: Member | undefined;
  total: number;
  contributors?: number | undefined;
  action?: ReactNode;
  emptyText?: string | undefined;
}) {
  return (
    <div className="rounded-2xl border border-gold/40 bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
          {deskLabel(event.event_no).en} · <span className="font-ml normal-case">{deskLabel(event.event_no).ml}</span>
        </p>
        <SelectionBadge type={event.selection_type} />
      </div>
      {recipient ? (
        <>
          <p className="mt-2 text-lg font-bold text-primary">{recipient.name}</p>
          <p className="text-sm text-muted-foreground">{departmentLabel(recipient.department)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyText ?? (event.selection_type === "lottery" ? "Winner picked by the lottery wheel" : "To be announced")}
        </p>
      )}
      <div className="mt-3 flex items-end justify-between gap-2 rounded-xl bg-muted p-3">
        <div>
          <p className="font-ml text-[11px] text-muted-foreground">ഈ പയറ്റിൽ ലഭിച്ചത്</p>
          <p className="text-xs text-muted-foreground">Total received</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary">{formatINR(total)}</p>
          {contributors !== undefined && (
            <p className="text-[11px] text-muted-foreground">
              from {contributors} member{contributors === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
      {action && <div className="mt-3 flex justify-end">{action}</div>}
    </div>
  );
}

/** Compact list of every past and current Payattu recipient with their own total. */
export function EventHistory({
  events,
  memberMap,
  totals,
  highlightMemberId,
}: {
  events: PayattEvent[];
  memberMap: Map<string, Member>;
  totals: Map<string, number>;
  highlightMemberId?: string | null | undefined;
}) {
  if (events.length === 0)
    return <p className="p-4 text-center text-sm text-muted-foreground">No Payattu recorded yet.</p>;
  const sorted = [...events].sort((a, b) => b.month.localeCompare(a.month) || a.event_no - b.event_no);
  return (
    <ul className="divide-y">
      {sorted.map((e) => {
        const r = e.recipient_member_id ? memberMap.get(e.recipient_member_id) : undefined;
        return (
          <li
            key={e.id}
            className={cn(
              "flex items-center gap-3 px-1 py-2.5",
              highlightMemberId && e.recipient_member_id === highlightMemberId && "rounded-xl bg-gold-soft px-2",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {formatMonth(e.month)} · {deskLabel(e.event_no).en}
              </p>
              <p className="truncate text-sm font-semibold">{r?.name ?? "Recipient not decided"}</p>
              <div className="mt-1">
                <SelectionBadge type={e.selection_type} />
              </div>
            </div>
            <p className="shrink-0 text-right text-base font-bold text-primary">{formatINR(totals.get(e.id) ?? 0)}</p>
          </li>
        );
      })}
    </ul>
  );
}
