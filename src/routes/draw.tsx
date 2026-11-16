import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Disc3, Hourglass, Loader2, Lock, PartyPopper, Radio, Send, Timer } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { SpinWheel, type SpinWheelHandle } from "@/components/SpinWheel";
import { DrawAlertsCard } from "@/components/live/DrawAlertsToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SNAPSHOT_KEY, type LiveDraw } from "@/lib/queries";
import { useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { useLiveDraw } from "@/lib/live-draw";
import { useRole } from "@/lib/role-context";
import { getLiveRoster, saveMonth, startLiveSpin } from "@/lib/payatt.functions";
import { deskLabel, formatCountdown, formatDrawAt, formatMonth } from "@/lib/payatt-rules";

export const Route = createFileRoute("/draw")({
  head: () => ({
    meta: [
      { title: "Live Wheel Arena · സൗഹൃദ പണപ്പയറ്റ്" },
      {
        name: "description",
        content: "Live lucky wheel draw for the Lottery Payattu Desks: the first member to spin locks the wheel for everyone.",
      },
      { property: "og:title", content: "Live Wheel Arena · ഭാഗ്യചക്രം" },
      { property: "og:description", content: "Join the live lucky wheel draw of the Sauhrida Panappayattu." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DrawPage,
});

async function burstConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#d4af37", "#f5e6b3", "#065f46", "#fdfbf7"];
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.55 }, colors });
  setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0 }, colors }), 250);
  setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1 }, colors }), 400);
}

function DrawPage() {
  const snap = useSnapshot();
  const live = useLiveDraw(snap);
  const memberMap = useMemberMap();
  const { role, token, member, viewerToken } = useRole();
  const qc = useQueryClient();
  const spin = useServerFn(startLiveSpin);
  const save = useServerFn(saveMonth);
  const wheelRef = useRef<SpinWheelHandle>(null);
  const animated = useRef<string | null>(null);
  const [animDraw, setAnimDraw] = useState<LiveDraw | null>(null);
  const [result, setResult] = useState<{ name: string; desk: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Members spin under their own name; the Admin spins as "Admin".
  const spinToken = member && !member.mustChange ? member.token : role === "admin" ? token : null;
  const monthKey = live?.month.month ?? null;

  const roster = useQuery({
    queryKey: ["live-roster", monthKey, live?.draws.length ?? 0, snap.events.length],
    queryFn: () => getLiveRoster({ data: { token: viewerToken!, month: monthKey! } }),
    enabled: !!monthKey && !!viewerToken,
  });

  const entries = useMemo(
    () =>
      animDraw
        ? animDraw.candidate_names.map((label, i) => ({ id: animDraw.candidate_ids[i] ?? String(i), label }))
        : (roster.data ?? []),
    [animDraw, roster.data],
  );

  // Someone (maybe on another phone) claimed the spin: play the same spin here.
  const spinningDraw = live?.spinning ?? null;
  useEffect(() => {
    if (spinningDraw && animated.current !== spinningDraw.id) {
      animated.current = spinningDraw.id;
      setResult(null);
      setAnimDraw(spinningDraw);
    }
  }, [spinningDraw]);

  // Once the wheel shows that draw's names, animate it to land exactly when the server says.
  useEffect(() => {
    if (!animDraw) return;
    const end = new Date(animDraw.started_at).getTime() + animDraw.duration_ms;
    const remaining = end - (Date.now() + snap.clockOffset);
    const duration = Math.max(600, remaining);
    const turns = Math.max(1, Math.round((7 * duration) / animDraw.duration_ms));
    const t = setTimeout(() => wheelRef.current?.spinTo(animDraw.winner_index, duration, turns), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animDraw?.id]);

  const onResult = useCallback(
    (e: { id: string; label: string }) => {
      if (animDraw) setResult({ name: e.label, desk: animDraw.event_no });
      void burstConfetti();
      void qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      setTimeout(() => setAnimDraw(null), 6000);
    },
    [animDraw, qc],
  );

  async function onSpin() {
    if (!live?.target || !spinToken) return;
    setBusy(true);
    try {
      const res = await spin({ data: { token: spinToken, event_id: live.target.id } });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        animated.current = res.draw.id;
        setResult(null);
        setAnimDraw(res.draw);
      }
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not spin");
    } finally {
      setBusy(false);
    }
  }

  async function setOverride(v: boolean) {
    if (!token || !live) return;
    const m = live.month;
    try {
      await save({
        data: { token, month: m.month, payatt_date: m.payatt_date, venue: m.venue, event_time: m.event_time, wheel_override: v },
      });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      toast.success(v ? "Wheel opened for testing" : "Wheel back on its schedule");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change");
    }
  }

  if (!live || live.phase === "none") {
    return (
      <div className="space-y-4">
        <PageTitle en="Live Wheel Arena" ml="ഭാഗ്യചക്ര നറുക്കെടുപ്പ്" />
        <div className="rounded-3xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <Disc3 className="mx-auto mb-2 size-10 text-gold" />
          No Payattu Desk is waiting for a lottery draw right now.
        </div>
        <DrawAlertsCard />
      </div>
    );
  }

  const lotteryEvents = live.events.filter((e) => e.selection_type === "lottery");
  const watching = !!animDraw;
  const canSpin = live.phase === "open" && !!spinToken && !watching && !busy;
  const spinNo = live.target ? lotteryEvents.findIndex((e) => e.id === live.target!.id) + 1 : 0;

  return (
    <div className="space-y-4">
      <PageTitle en="Live Wheel Arena" ml="ഭാഗ്യചക്ര നറുക്കെടുപ്പ്">
        <Badge variant={live.phase === "open" || watching ? "gold" : "outline"} className="gap-1">
          {live.phase === "open" || watching ? <Radio className="size-3 animate-pulse" /> : <Lock className="size-3" />}
          {watching ? "Spinning" : live.phase === "open" ? "Live now" : live.phase === "done" ? "Finished" : "Locked"}
        </Badge>
      </PageTitle>

      <section className="rounded-3xl bg-emerald-gradient p-5 text-center text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">{formatMonth(live.month.month)}</p>
        <p className="mt-1 text-sm">
          {lotteryEvents.length === 2
            ? "Two lottery desks: Spin 1 picks Desk 1, then Spin 2 picks Desk 2 from the rest."
            : `${deskLabel(lotteryEvents[0]!.event_no).en} is picked by the lucky wheel.`}
        </p>
        {(live.phase === "countdown" || live.phase === "alert") && live.month.draw_at && (
          <>
            <p className="font-ml mt-3 text-sm text-gold-soft">അടുത്ത നറുക്കെടുപ്പ് സമയം · {formatDrawAt(live.month.draw_at)}</p>
            <p className="mt-1 flex items-center justify-center gap-2 font-mono text-4xl font-extrabold tabular-nums">
              <Timer className="size-7 text-gold-soft" /> {formatCountdown(live.msLeft)}
            </p>
            <p className="mt-1 text-xs text-primary-foreground/75">The spin button unlocks for everyone at zero.</p>
          </>
        )}
        {live.phase === "unscheduled" && (
          <p className="mt-3 text-sm text-gold-soft">The Admin will announce the draw date &amp; time soon.</p>
        )}
        {live.phase === "intermission" && !watching && (
          <p className="mt-3 flex items-center justify-center gap-2 text-lg font-bold">
            <Hourglass className="size-5 text-gold-soft" /> Spin 2 unlocks in {formatCountdown(live.gapLeft)}
          </p>
        )}
      </section>

      <div className="relative flex flex-col items-center rounded-3xl border-2 border-gold/60 bg-card p-4 shadow-gold">
        {watching && animDraw && (
          <p className="font-ml mb-3 w-full rounded-2xl bg-gold-soft p-3 text-center text-sm font-bold text-accent-foreground">
            ചക്രം കറക്കിയത്: {animDraw.spun_by_name}... ഫലത്തിനായി കാത്തിരിക്കുന്നു!
            <span className="block font-sans text-xs font-medium text-muted-foreground">
              {deskLabel(animDraw.event_no).en} — the same spin is playing on every phone
            </span>
          </p>
        )}
        {entries.length === 0 && roster.isLoading ? (
          <Loader2 className="my-20 size-8 animate-spin text-gold" />
        ) : (
          <SpinWheel ref={wheelRef} entries={entries} onResult={onResult} />
        )}
        {!watching && live.phase !== "done" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {entries.length} eligible member{entries.length === 1 ? "" : "s"} on the wheel
          </p>
        )}

        {result && (
          <div className="mt-4 w-full rounded-2xl border-2 border-gold bg-gold-soft p-4 text-center">
            <PartyPopper className="mx-auto size-8 text-gold" />
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
              {deskLabel(result.desk).en} · <span className="font-ml normal-case">{deskLabel(result.desk).ml}</span>
            </p>
            <p className="mt-1 text-2xl font-extrabold text-primary">{result.name}</p>
          </div>
        )}

        {live.phase !== "done" && (
          <Button
            variant="gold"
            size="xl"
            className={`mt-4 w-full max-w-sm ${canSpin ? "animate-pulse" : ""}`}
            disabled={!canSpin}
            onClick={onSpin}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Disc3 />}
            {live.target && lotteryEvents.length === 2 ? `Spin ${spinNo} · ` : ""}Spin the Wheel
          </Button>
        )}
        {live.phase === "open" && !spinToken && (
          <p className="mt-2 text-xs text-muted-foreground">Sign in as a member to take the spin.</p>
        )}
        {live.phase === "open" && !watching && (
          <p className="mt-2 text-xs text-muted-foreground">The first member to tap spins it for everyone.</p>
        )}
      </div>

      <section className="rounded-3xl border bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-semibold text-primary">
          <Crown className="size-4 text-gold" /> Winners · <span className="font-ml text-sm">വിജയികൾ</span>
        </h2>
        <ul className="mt-2 space-y-2">
          {lotteryEvents.map((e) => {
            const d = live.draws.find((x) => x.event_id === e.id);
            const showName = e.recipient_member_id && !(animDraw && animDraw.event_id === e.id && !result);
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {deskLabel(e.event_no).en} · <span className="font-ml">{deskLabel(e.event_no).ml}</span>
                  </p>
                  <p className="font-semibold">
                    {showName ? memberMap.get(e.recipient_member_id!)?.name : <span className="text-muted-foreground">Waiting for the spin</span>}
                  </p>
                  {showName && d && <p className="text-[11px] text-muted-foreground">Spun by {d.spun_by_name}</p>}
                </div>
                {showName && <Crown className="size-5 text-gold" />}
              </li>
            );
          })}
        </ul>
        {live.phase === "done" && (
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/tea">
              <Send /> Share the WhatsApp invitation
            </Link>
          </Button>
        )}
      </section>

      <DrawAlertsCard />

      {role === "admin" && live.phase !== "done" && (
        <div className="flex items-center justify-between rounded-2xl bg-muted p-3">
          <div>
            <p className="text-sm font-medium">Admin test: open the wheel now</p>
            <p className="text-xs text-muted-foreground">Ignores the scheduled draw time.</p>
          </div>
          <Switch checked={live.month.wheel_override} onCheckedChange={setOverride} />
        </div>
      )}
    </div>
  );
}
