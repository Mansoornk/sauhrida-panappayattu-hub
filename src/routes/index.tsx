import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crown,
  History,
  Hourglass,
  MapPin,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react";
import { useActiveMonth, useEventTotals, useMemberMap, useMonthEvents, useSnapshot } from "@/lib/use-payatt";
import {
  DEFAULT_TIME,
  DEFAULT_VENUE,
  deskLabel,
  describeMonthMode,
  formatDate,
  formatINR,
  formatMonth,
  TEA_MENU,
  wheelDayFor,
} from "@/lib/payatt-rules";
import { EventCard, EventHistory } from "@/components/EventCards";
import { NextDrawCard } from "@/components/live/NextDrawCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pool Scorecard · Sauhrida Panappayattu" },
      {
        name: "description",
        content:
          "Live scorecard for the zero-interest Panappayattu of Sir Syed College, Taliparamba faculty: each recipient's own total.",
      },
      { property: "og:title", content: "Sauhrida Panappayattu — 36 Hearts, Zero Interest" },
      {
        property: "og:description",
        content: "This month's Payattu recipients, Priority or Lottery, and what each one received.",
      },
    ],
  }),
  component: Scorecard,
});

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

function Scorecard() {
  const { members, contributions, events } = useSnapshot();
  const { month, monthKey, today } = useActiveMonth();
  const memberMap = useMemberMap();
  const monthEvents = useMonthEvents(monthKey);
  const totals = useEventTotals();

  const totalPool = contributions.reduce((s, c) => s + c.amount, 0);
  const monthRows = contributions.filter((c) => c.month === monthKey);
  const monthTotal = monthRows.reduce((s, c) => s + c.amount, 0);
  const paidIds = new Set(monthRows.map((c) => c.member_id));
  const conductedCount = members.filter((m) => m.has_conducted).length;
  const daysLeft = month ? daysBetween(today, month.payatt_date) : null;
  const recipientIds = new Set(monthEvents.map((e) => e.recipient_member_id).filter(Boolean));

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-emerald-gradient p-5 text-primary-foreground shadow-card">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-gold/30" />
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full border border-gold/20" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">This month's Payattu Desks</p>
            {month?.ledger_published ? (
              <Badge variant="success">Ledger published</Badge>
            ) : (
              <Badge variant="warning">Under admin review</Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{formatMonth(monthKey)}</h1>
          <p className="text-sm text-gold-soft">{describeMonthMode(monthEvents)}</p>
          {month ? (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-primary-foreground/85">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4 text-gold-soft" /> {formatDate(month.payatt_date)}
              </span>
              {month.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-gold-soft" /> {month.venue}
                </span>
              )}
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="flex items-center gap-1.5">
                  <Hourglass className="size-4 text-gold-soft" />
                  {daysLeft === 0 ? "Today!" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-primary-foreground/80">The Admin hasn't scheduled a Payattu yet.</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-ivory/10 p-3 ring-1 ring-gold/30">
              <p className="font-ml text-xs text-gold-soft">ഈ മാസം ആകെ</p>
              <p className="mt-1 text-2xl font-bold">{formatINR(monthTotal)}</p>
              <p className="text-[10px] text-primary-foreground/60">all recipients together</p>
            </div>
            <div className="rounded-2xl bg-ivory/10 p-3 ring-1 ring-gold/30">
              <p className="font-ml text-xs text-gold-soft">അടച്ചവർ</p>
              <p className="mt-1 text-2xl font-bold">
                {paidIds.size}
                <span className="text-base font-medium text-primary-foreground/70"> / {members.length}</span>
              </p>
              <p className="text-[10px] text-primary-foreground/60">members who gave this month</p>
            </div>
          </div>
        </div>
      </section>

      <NextDrawCard />

      {month && (
        <section className="rounded-3xl border border-gold/50 bg-card p-4 shadow-card" aria-label="Announcements Corner">
          <h2 className="flex items-center gap-2 font-semibold text-primary">
            <Megaphone className="size-4 text-gold" /> Announcements Corner ·{" "}
            <span className="font-ml text-sm">അറിയിപ്പുകൾ</span>
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-gold" />
              <div>
                <dt className="text-xs text-muted-foreground">Date</dt>
                <dd className="font-semibold">{formatDate(month.payatt_date)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-gold" />
              <div>
                <dt className="text-xs text-muted-foreground">Time</dt>
                <dd className="font-ml font-semibold">{month.event_time || DEFAULT_TIME}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
              <div>
                <dt className="text-xs text-muted-foreground">Venue</dt>
                <dd className="font-ml font-semibold">{month.venue || DEFAULT_VENUE}</dd>
              </div>
            </div>
          </dl>
          {monthEvents.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">Hosts · ആതിഥേയർ</p>
              <ul className="mt-1 space-y-1">
                {monthEvents.map((e) => {
                  const r = e.recipient_member_id ? memberMap.get(e.recipient_member_id) : undefined;
                  return (
                    <li key={e.id} className="text-sm">
                      <span className="font-ml text-accent-foreground">{deskLabel(e.event_no).ml}:</span>{" "}
                      <span className="font-semibold">{r?.name ?? "to be decided"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {month.tea_menu.length > 0 && (
            <details className="group mt-3 rounded-2xl bg-gold-soft p-3">
              <summary className="font-ml flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-accent-foreground">
                ☕ ഇന്നത്തെ ചായസൽക്കാര വിഭവങ്ങൾ
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {TEA_MENU.filter((t) => month.tea_menu.includes(t.id)).map((t) => (
                  <li key={t.id} className="rounded-full border border-gold/40 bg-card px-2.5 py-1 text-xs">
                    {t.en} · <span className="font-ml">{t.ml}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-primary">
          {formatMonth(monthKey)} recipients · <span className="font-ml text-sm">സ്വീകർത്താക്കൾ</span>
        </h2>
        {monthEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            The Admin hasn't set up this month's Payattu Desks yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {monthEvents.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                recipient={e.recipient_member_id ? memberMap.get(e.recipient_member_id) : undefined}
                total={totals.get(e.id) ?? 0}
                contributors={new Set(contributions.filter((c) => c.event_id === e.id).map((c) => c.member_id)).size}
                emptyText={
                  e.selection_type === "lottery" && month
                    ? `Lottery wheel opens on ${formatDate(wheelDayFor(month.payatt_date))}`
                    : undefined
                }
                action={
                  e.selection_type === "lottery" && !e.recipient_member_id ? (
                    <Button asChild variant="gold" size="sm">
                      <Link to="/draw">View wheel</Link>
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Each desk is a separate ledger: its total is only what members gave to that recipient — nothing is pooled or split.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Given so far (all months)" ml="ആകെ" value={formatINR(totalPool)} icon={Sparkles} />
        <Stat label="Payattus received" ml="ലഭിച്ചവർ" value={`${conductedCount} / ${members.length}`} icon={Crown} />
        <Stat label="Payattu Desks on record" ml="ഡെസ്കുകൾ" value={String(events.length)} icon={CalendarDays} />
      </div>

      <section className="rounded-3xl border bg-card p-4 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-primary">
          <History className="size-4" /> All Payattu recipients
        </h2>
        <p className="font-ml mb-2 text-xs text-muted-foreground">ഓരോ സ്വീകർത്താവിനും ലഭിച്ച തുക</p>
        <EventHistory events={events} memberMap={memberMap} totals={totals} />
      </section>

      <section className="rounded-3xl border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-primary">
              <Users className="size-4" /> The 36 Hearts
            </h2>
            <p className="font-ml text-xs text-muted-foreground">പ്രസിദ്ധീകരിച്ച അടവുകൾ മാത്രം കാണിക്കുന്നു</p>
          </div>
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-success" /> Paid
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-gold" /> Received
            </span>
          </div>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const paid = paidIds.has(m.id);
            return (
              <li
                key={m.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                  recipientIds.has(m.id)
                    ? "border-gold/50 bg-gold-soft"
                    : paid
                      ? "border-success/30 bg-success-soft/50"
                      : "border-border bg-background",
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-primary">
                  {m.slot_no}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{m.department}</span>
                </span>
                {m.has_conducted && <Crown className="size-4 shrink-0 text-gold" aria-label="Received a Payattu" />}
                {paid && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Paid" />}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, ml, value, icon: Icon }: { label: string; ml: string; value: string; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <span className="grid size-10 place-items-center rounded-xl bg-gold-soft text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-lg font-bold text-primary">{value}</p>
        <p className="text-xs text-muted-foreground">
          {label} · <span className="font-ml">{ml}</span>
        </p>
      </div>
    </div>
  );
}
