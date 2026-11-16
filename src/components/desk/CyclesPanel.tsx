import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { MemberSelect } from "@/components/MemberSelect";
import { SelectionBadge } from "@/components/EventCards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deskDataQuery, SNAPSHOT_KEY, type PayattEvent } from "@/lib/queries";
import { useMonthEvents, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { deleteEvent, saveContributionSheet, saveEvent, saveMonth } from "@/lib/payatt.functions";
import {
  addDays,
  drawAtFromIST,
  drawAtToIST,
  formatDate,
  cycleMonthNumber,
  DEFAULT_TIME,
  DEFAULT_VENUE,
  describeMonthMode,
  formatINR,
  formatMonth,
  maxEventsForMonth,
  MIN_CONTRIBUTION,
  REASON_LABELS,
  type PriorityReason,
  type SelectionType,
} from "@/lib/payatt-rules";
import { deskLabel } from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

/** "Manage Past & Current Payattu Cycles": date/venue, each Payattu event, and member-wise entry sheets. */
export function CyclesPanel({ month, onAddMonth }: { month: string; onAddMonth?: () => void }) {
  const { months } = useSnapshot();
  const events = useMonthEvents(month);
  const monthRow = months.find((m) => m.month === month);
  const max = maxEventsForMonth(month);
  const n = cycleMonthNumber(month);
  const [adding, setAdding] = useState(false);
  const nextNo = [1, 2].find((no) => no <= max && !events.some((e) => e.event_no === no));

  useEffect(() => setAdding(false), [month]);

  if (max === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        The Payattu timeline starts in October 2026. Pick October or a later month.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-emerald-gradient p-5 text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">Manage Past &amp; Current Payattu Cycles</p>
        <h2 className="mt-1 text-2xl font-bold">
          {formatMonth(month)} <span className="text-base font-medium text-gold-soft">· Month {n}</span>
        </h2>
        <p className="text-sm text-primary-foreground/80">
          {max === 1 ? "October has a single Payattu Desk." : "Up to two Payattu Desks, each Priority or Lottery."} Now:{" "}
          {describeMonthMode(events)}
        </p>
        {onAddMonth && (
          <Button variant="gold" size="sm" className="mt-3" onClick={onAddMonth}>
            <Plus /> Add New Month / Cycle
          </Button>
        )}
      </div>

      <MonthDetails month={month} key={`${month}-${monthRow?.id ?? "new"}`} />

      {!monthRow ? (
        <p className="rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
          Save the date first, then add this month's Payattu.
        </p>
      ) : (
        <>
          {events.map((e) => (
            <div key={e.id} className="space-y-3 rounded-3xl border bg-card p-4 shadow-card">
              <EventEditor month={month} event={e} eventNo={e.event_no} siblings={events} />
              <ContributionSheet event={e} />
            </div>
          ))}
          {adding && nextNo && (
            <div className="rounded-3xl border border-gold bg-card p-4 shadow-card">
              <EventEditor
                month={month}
                event={null}
                eventNo={nextNo}
                siblings={events}
                onSaved={() => setAdding(false)}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
          {!adding && nextNo && (
            <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
              <Plus /> Add {deskLabel(nextNo).en}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Entries saved here are verified drafts. Publish them from the Review tab so members can see them.
          </p>
        </>
      )}
    </div>
  );
}

function MonthDetails({ month }: { month: string }) {
  const { months } = useSnapshot();
  const { token } = useRole();
  const qc = useQueryClient();
  const save = useServerFn(saveMonth);
  const existing = months.find((m) => m.month === month);
  const events = useMonthEvents(month);
  const hasLottery = events.some((e) => e.selection_type === "lottery");
  const savedDraw = existing?.draw_at ? drawAtToIST(existing.draw_at) : null;
  const [f, setF] = useState({
    payatt_date: existing?.payatt_date ?? `${month.slice(0, 7)}-28`,
    venue: existing?.venue ?? DEFAULT_VENUE,
    event_time: existing?.event_time ?? DEFAULT_TIME,
    wheel_override: existing?.wheel_override ?? false,
  });
  const [draw, setDraw] = useState({ date: savedDraw?.date ?? "", time: savedDraw?.time ?? "15:45" });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) return;
    setBusy(true);
    try {
      const draw_at = draw.date && draw.time ? drawAtFromIST(draw.date, draw.time) : null;
      await save({ data: { token, month, ...f, draw_at } });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      toast.success(`${formatMonth(month)} saved`);
    } catch (e) {
      toast.error(errMsg(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-primary">
          <CalendarDays className="size-4" /> Date, time &amp; venue
        </h3>
        {!existing && <Badge variant="warning">Not saved yet</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pdate">Payattu date</Label>
          <Input id="pdate" type="date" value={f.payatt_date} onChange={(e) => setF({ ...f, payatt_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ptime">Time</Label>
          <Input id="ptime" value={f.event_time} onChange={(e) => setF({ ...f, event_time: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-gold/50 bg-gold-soft p-3">
        <p className="text-sm font-semibold text-accent-foreground">
          Live lucky wheel draw · <span className="font-ml">നറുക്കെടുപ്പ് സമയം</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {hasLottery
            ? "Usually 2–3 days before the gathering. Members get a phone alert 1 minute before, and the wheel unlocks at this time."
            : "Only needed when a desk this month is picked by lottery."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ddate">Draw date</Label>
            <Input id="ddate" type="date" value={draw.date} onChange={(e) => setDraw({ ...draw, date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dtime">Draw time (India)</Label>
            <Input id="dtime" type="time" value={draw.time} onChange={(e) => setDraw({ ...draw, time: e.target.value })} />
          </div>
        </div>
        {!draw.date && f.payatt_date && hasLottery && (
          <Button size="sm" variant="outline" onClick={() => setDraw({ ...draw, date: addDays(f.payatt_date, -2) })}>
            Use {formatDate(addDays(f.payatt_date, -2))}
          </Button>
        )}
        {draw.date && (
          <Button size="sm" variant="ghost" onClick={() => setDraw({ ...draw, date: "" })}>
            Clear draw time
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <div>
          <p className="text-sm font-medium">Wheel test override</p>
          <p className="text-xs text-muted-foreground">Unlocks the lottery wheel on any day.</p>
        </div>
        <Switch checked={f.wheel_override} onCheckedChange={(v) => setF({ ...f, wheel_override: v })} />
      </div>
      <Button variant="gold" className="w-full" onClick={submit} disabled={busy || !f.payatt_date}>
        {busy ? <Loader2 className="animate-spin" /> : <Save />} Save schedule
      </Button>
    </div>
  );
}

function EventEditor({
  month,
  event,
  eventNo,
  siblings,
  onSaved,
  onCancel,
}: {
  month: string;
  event: PayattEvent | null;
  eventNo: number;
  siblings: PayattEvent[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { members } = useSnapshot();
  const { token } = useRole();
  const qc = useQueryClient();
  const save = useServerFn(saveEvent);
  const remove = useServerFn(deleteEvent);
  const [f, setF] = useState({
    selection_type: (event?.selection_type ?? "priority") as SelectionType,
    recipient_member_id: event?.recipient_member_id ?? null,
    priority_reason: (event?.priority_reason ?? null) as PriorityReason | null,
    notes: event?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event) return;
    setF({
      selection_type: event.selection_type as SelectionType,
      recipient_member_id: event.recipient_member_id,
      priority_reason: event.priority_reason as PriorityReason | null,
      notes: event.notes ?? "",
    });
  }, [event]);

  const otherRecipient = siblings.find((s) => s.id !== event?.id)?.recipient_member_id;
  const choices = members.filter(
    (m) => m.id === f.recipient_member_id || (!m.has_conducted && m.id !== otherRecipient),
  );
  const dirty =
    !event ||
    f.selection_type !== event.selection_type ||
    f.recipient_member_id !== event.recipient_member_id ||
    f.priority_reason !== event.priority_reason ||
    f.notes !== (event.notes ?? "");

  async function submit() {
    if (!token) return;
    if (f.selection_type === "priority" && f.recipient_member_id && !f.priority_reason)
      return void toast.error("Choose the priority need");
    setBusy(true);
    try {
      await save({
        data: {
          token,
          id: event?.id,
          month,
          event_no: eventNo,
          selection_type: f.selection_type,
          recipient_member_id: f.recipient_member_id,
          priority_reason: f.selection_type === "priority" ? f.priority_reason : null,
          notes: f.notes || null,
        },
      });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      toast.success(`${deskLabel(eventNo).en} saved`);
      onSaved?.();
    } catch (e) {
      toast.error(errMsg(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!token || !event || !confirm(`Remove ${deskLabel(eventNo).en}?`)) return;
    try {
      await remove({ data: { token, id: event.id } });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      toast.success(`${deskLabel(eventNo).en} removed`);
    } catch (e) {
      toast.error(errMsg(e, "Could not remove"));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-primary">
          {deskLabel(eventNo).en} · <span className="font-ml">{deskLabel(eventNo).ml}</span>
        </h3>
        {event && <SelectionBadge type={event.selection_type} />}
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Selection type">
        {(["priority", "lottery"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={f.selection_type === t}
            onClick={() => setF({ ...f, selection_type: t })}
            className={cn(
              "rounded-xl border p-2.5 text-sm font-semibold transition-colors",
              f.selection_type === t ? "border-gold bg-gold-soft text-accent-foreground" : "bg-background hover:bg-muted",
            )}
          >
            {t === "priority" ? "Priority (urgent need)" : "Lottery (wheel)"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Recipient</Label>
        <MemberSelect
          members={choices}
          value={f.recipient_member_id}
          onChange={(id) => setF({ ...f, recipient_member_id: id })}
          allowNone
        />
        {f.selection_type === "lottery" && !f.recipient_member_id && (
          <p className="text-xs text-muted-foreground">
            Leave empty to pick the winner on the Draw page, or choose the past winner here.
          </p>
        )}
      </div>

      {f.selection_type === "priority" && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REASON_LABELS) as PriorityReason[]).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={f.priority_reason === r ? "default" : "outline"}
              onClick={() => setF({ ...f, priority_reason: r })}
            >
              {REASON_LABELS[r].en}
            </Button>
          ))}
        </div>
      )}

      <Textarea
        rows={1}
        placeholder="Notes (optional)"
        value={f.notes}
        maxLength={300}
        onChange={(e) => setF({ ...f, notes: e.target.value })}
      />

      <div className="flex gap-2">
        <Button variant="gold" className="flex-1" onClick={submit} disabled={busy || !dirty}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} {event ? "Save Payattu" : `Add ${deskLabel(eventNo).en}`}
        </Button>
        {event ? (
          <Button variant="ghost" size="icon" aria-label={`Remove ${deskLabel(eventNo).en}`} onClick={onDelete}>
            <Trash2 />
          </Button>
        ) : (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/** Member-wise amounts given to one recipient. Empty means "did not give". */
function ContributionSheet({ event }: { event: PayattEvent }) {
  const { members } = useSnapshot();
  const { token } = useRole();
  const qc = useQueryClient();
  const desk = useQuery(deskDataQuery(token, event.month));
  const save = useServerFn(saveContributionSheet);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const existing = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of desk.data?.contributions ?? [])
      if (c.event_id === event.id && c.status !== "rejected") map.set(c.member_id, c.amount);
    return map;
  }, [desk.data, event.id]);

  const givers = members.filter((m) => m.id !== event.recipient_member_id);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(Object.fromEntries(givers.map((m) => [m.id, existing.has(m.id) ? String(existing.get(m.id)) : ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, event.recipient_member_id]);

  const total = Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0);
  const count = Object.values(values).filter((v) => Number(v) > 0).length;
  const invalid = Object.values(values).some((v) => v !== "" && Number(v) < MIN_CONTRIBUTION);

  const changes = givers
    .map((m) => {
      const v = values[m.id] ?? "";
      const next = v === "" ? null : Number(v);
      const cur = existing.get(m.id) ?? null;
      return next === cur ? null : { member_id: m.id, amount: next };
    })
    .filter((x): x is { member_id: string; amount: number | null } => x !== null);

  async function submit() {
    if (!token || changes.length === 0) return;
    if (invalid) return void toast.error(`Each amount must be at least ${formatINR(MIN_CONTRIBUTION)}`);
    setBusy(true);
    try {
      const res = await save({ data: { token, event_id: event.id, entries: changes } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["desk"] }),
        qc.invalidateQueries({ queryKey: SNAPSHOT_KEY }),
      ]);
      toast.success(`Saved ${res.saved} entr${res.saved === 1 ? "y" : "ies"}${res.removed ? `, removed ${res.removed}` : ""}`);
    } catch (e) {
      toast.error(errMsg(e, "Could not save sheet"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-background">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-semibold">Contribution sheet · {deskLabel(event.event_no).en}</span>
          <span className="block text-xs text-muted-foreground">
            {count} member{count === 1 ? "" : "s"} · total {formatINR(total)}
          </span>
        </span>
        <span className="text-xs font-medium text-accent-foreground">{open ? "Hide" : "Open"}</span>
      </button>
      {open && (
        <div className="border-t p-3">
          {desk.isLoading ? (
            <div className="grid place-items-center p-6">
              <Loader2 className="size-5 animate-spin text-gold" />
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setValues((v) =>
                      Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? String(MIN_CONTRIBUTION) : x])),
                    )
                  }
                >
                  Fill empty with {formatINR(MIN_CONTRIBUTION)}
                </Button>
              </div>
              <ul className="divide-y">
                {givers.map((m) => {
                  const v = values[m.id] ?? "";
                  const bad = v !== "" && Number(v) < MIN_CONTRIBUTION;
                  return (
                    <li key={m.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-6 text-xs font-bold text-muted-foreground">{m.slot_no}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                      <Input
                        inputMode="numeric"
                        aria-label={`Amount from ${m.name}`}
                        placeholder="—"
                        value={v}
                        onChange={(e) => setValues({ ...values, [m.id]: e.target.value.replace(/\D/g, "") })}
                        className={cn("h-9 w-28 text-right", bad && "border-destructive")}
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="sticky bottom-16 mt-3 flex items-center justify-between gap-2 rounded-xl bg-card p-2 shadow-card md:bottom-2">
                <p className="text-sm">
                  Total <span className="font-bold text-primary">{formatINR(total)}</span>
                </p>
                <Button variant="gold" onClick={submit} disabled={busy || changes.length === 0 || invalid}>
                  {busy ? <Loader2 className="animate-spin" /> : <Save />} Save sheet
                  {changes.length ? ` (${changes.length})` : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
