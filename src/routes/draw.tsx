import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Crown, Lock, PartyPopper, ShieldCheck, Unlock } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { SpinWheel, type SpinWheelHandle } from "@/components/SpinWheel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { deskDataQuery, publicSnapshotQuery } from "@/lib/queries";
import { useActiveMonth, useMemberMap, useMonthEvents, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { confirmLotteryWinner, saveMonth } from "@/lib/payatt.functions";
import {
  canSpinWheel,
  deskLabel,
  eventsNeedingDraw,
  wheelWindow,
  formatDate,
  formatMonth,
  wheelCandidates,
} from "@/lib/payatt-rules";

export const Route = createFileRoute("/draw")({
  head: () => ({
    meta: [
      { title: "Lottery Draw · Sauhrida Panappayattu" },
      {
        name: "description",
        content: "Admin-run spinning wheel that picks the Lottery Payattu Desk recipient from eligible verified members.",
      },
      { property: "og:title", content: "Payattu Lottery Wheel — നറുക്കെടുപ്പ്" },
      { property: "og:description", content: "Opens 2–3 days before the Payattu, run by the Admin." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicSnapshotQuery),
  component: DrawPage,
});

function DrawPage() {
  const { members, contributions } = useSnapshot();
  const { month, monthKey, today } = useActiveMonth();
  const monthEvents = useMonthEvents(monthKey);
  const memberMap = useMemberMap();
  const { role, token } = useRole();
  const qc = useQueryClient();
  const desk = useQuery({ ...deskDataQuery(token, monthKey), enabled: role === "admin" && !!token });
  const confirm = useServerFn(confirmLotteryWinner);
  const save = useServerFn(saveMonth);
  const wheelRef = useRef<SpinWheelHandle>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const lotteryEvents = monthEvents.filter((e) => e.selection_type === "lottery");
  const pending = eventsNeedingDraw(monthEvents);
  const target = pending[0] ?? null;

  // Admin sees verified entries including unpublished drafts; members see published ones.
  const verifiedSource = role === "admin" && desk.data ? desk.data.allVerified : contributions;
  const recipientIds = monthEvents.map((e) => e.recipient_member_id);
  const candidates = useMemo(
    () => wheelCandidates(members, verifiedSource, recipientIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, verifiedSource, recipientIds.join(",")],
  );
  const entries = candidates.map((m) => ({ id: m.id, label: m.name }));
  const override = month?.wheel_override ?? false;
  const canSpin = !!target && canSpinWheel({ role, today, payattDate: month?.payatt_date, override });
  const win = month ? wheelWindow(month.payatt_date) : null;

  async function toggleOverride(v: boolean) {
    if (!month || !token) return;
    try {
      await save({
        data: { token, month: month.month, payatt_date: month.payatt_date, venue: month.venue, wheel_override: v },
      });
      await qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey });
      toast.success(v ? "Test override ON — wheel unlocked" : "Override OFF — wheel follows the date lock");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  async function confirmWinner() {
    if (!winner || !token || !target) return;
    setBusy(true);
    try {
      await confirm({ data: { token, event_id: target.id, member_id: winner.id } });
      await qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey });
      toast.success(`${winner.label} is ${deskLabel(target.event_no).en} for ${formatMonth(monthKey)}`);
      setWinner(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm");
    } finally {
      setBusy(false);
    }
  }

  const winners = lotteryEvents.filter((e) => e.recipient_member_id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle en="Lottery Draw" ml="നറുക്കെടുപ്പ് ചക്രം">
        <Badge variant={canSpin ? "success" : "warning"} className="gap-1">
          {canSpin ? <Unlock className="size-3" /> : <Lock className="size-3" />}
          {canSpin ? "Unlocked" : "Locked"}
        </Badge>
      </PageTitle>

      {winners.map((e) => (
        <div key={e.id} className="mb-3 flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold-soft p-4">
          <Crown className="size-6 text-gold" />
          <div>
            <p className="text-xs uppercase tracking-wider text-accent-foreground">
              {formatMonth(monthKey)} · {deskLabel(e.event_no).en} lottery winner
            </p>
            <p className="font-bold text-primary">{memberMap.get(e.recipient_member_id!)?.name}</p>
          </div>
        </div>
      ))}

      {lotteryEvents.length === 0 ? (
        <section className="rounded-3xl border bg-card p-8 text-center shadow-card">
          <Ban className="mx-auto size-10 text-gold" />
          <h2 className="mt-3 font-semibold text-primary">No lottery draw for {formatMonth(monthKey)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthEvents.length === 0
              ? "The Admin hasn't set up this month's Payattu yet."
              : "This month's recipients are selected on a Priority basis, so the wheel is switched off."}
          </p>
        </section>
      ) : !target ? (
        <section className="rounded-3xl border bg-card p-8 text-center shadow-card">
          <PartyPopper className="mx-auto size-10 text-gold" />
          <p className="mt-3 text-sm text-muted-foreground">Every lottery desk this month already has a winner.</p>
        </section>
      ) : (
        <section className="flex flex-col items-center rounded-3xl bg-emerald-gradient p-5 text-primary-foreground shadow-card">
          <p className="mb-3 text-sm font-semibold text-gold-soft">
            Drawing for {deskLabel(target.event_no).en} · <span className="font-ml">{deskLabel(target.event_no).ml}</span>
            {pending.length > 1 ? ` (then ${deskLabel(pending[1]!.event_no).en})` : ""}
          </p>
          <SpinWheel
            ref={wheelRef}
            entries={entries}
            onSpinningChange={setSpinning}
            onResult={(e) => {
              setWinner(e);
              toast.success(`The wheel picked ${e.label}!`);
            }}
          />
          <p className="mt-3 text-sm text-primary-foreground/80">
            {entries.length} eligible member{entries.length === 1 ? "" : "s"} · verified &amp; not yet received
          </p>

          {canSpin ? (
            <Button
              variant="gold"
              size="xl"
              className="mt-4 w-full max-w-xs"
              disabled={spinning || entries.length === 0}
              onClick={() => wheelRef.current?.spin()}
            >
              {spinning ? "Spinning…" : "Spin the wheel"}
            </Button>
          ) : (
            <div className="mt-4 flex max-w-sm items-start gap-2 rounded-xl bg-ivory/10 p-3 text-sm ring-1 ring-gold/30">
              <Lock className="mt-0.5 size-4 shrink-0 text-gold-soft" />
              <span>
                {win
                  ? `The wheel opens only from ${formatDate(win.opens)} to ${formatDate(win.closes)} (2–3 days before the Payattu) and only under Admin monitoring.`
                  : "The Admin needs to schedule this month's Payattu first."}
              </span>
            </div>
          )}
        </section>
      )}

      {winner && role === "admin" && target && (
        <div className="mt-4 rounded-3xl border border-gold bg-card p-5 text-center shadow-gold">
          <PartyPopper className="mx-auto size-8 text-gold" />
          <p className="mt-2 text-sm text-muted-foreground">The wheel picked</p>
          <p className="text-2xl font-bold text-primary">{winner.label}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setWinner(null)}>
              Discard
            </Button>
            <Button variant="gold" onClick={confirmWinner} disabled={busy}>
              Confirm for {deskLabel(target.event_no).en}
            </Button>
          </div>
        </div>
      )}

      {role === "admin" && month && lotteryEvents.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Admin test override</p>
              <p className="text-xs text-muted-foreground">Unlock the wheel on any day for testing.</p>
            </div>
          </div>
          <Switch checked={override} onCheckedChange={toggleOverride} />
        </div>
      )}

      {target && (
        <section className="mt-5 rounded-3xl border bg-card p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold text-primary">On the wheel</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible members yet. Members join the wheel once they have a verified payment.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {entries.map((e) => (
                <span key={e.id} className="rounded-full border bg-background px-2.5 py-1 text-xs">
                  {e.label}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
