import { Link } from "@tanstack/react-router";
import { Crown, Disc3, Radio, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveDraw } from "@/lib/live-draw";
import { useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { deskLabel, formatCountdown, formatDrawAt, formatMonth } from "@/lib/payatt-rules";

/** Homepage: next live draw time with countdown, live status, then the lucky winners. */
export function NextDrawCard() {
  const snap = useSnapshot();
  const live = useLiveDraw(snap);
  const memberMap = useMemberMap();
  if (!live || live.phase === "none") return null;

  const lotteryEvents = live.events.filter((e) => e.selection_type === "lottery");
  const winners = lotteryEvents.filter((e) => e.recipient_member_id);
  const spinningBy = live.spinning?.spun_by_name;

  return (
    <section
      aria-label="Next live draw"
      className="relative overflow-hidden rounded-3xl border-2 border-gold/70 bg-card p-4 shadow-gold"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-gradient text-gold-foreground">
          {live.phase === "done" ? <Crown className="size-5" /> : <Disc3 className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-ml text-base font-bold leading-snug text-primary">
            {live.phase === "done" ? "ഭാഗ്യചക്ര ഫലം" : "അടുത്ത നറുക്കെടുപ്പ് സമയം"}{" "}
            <span className="font-sans text-sm font-semibold text-muted-foreground">
              ({live.phase === "done" ? "Lucky Draw Result" : "Next Live Draw Time"})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatMonth(live.month.month)} ·{" "}
            {lotteryEvents.map((e) => deskLabel(e.event_no).en).join(" then ")}
          </p>
        </div>
      </div>

      {(live.phase === "countdown" || live.phase === "alert") && live.month.draw_at && (
        <div className="mt-3 rounded-2xl bg-emerald-gradient p-4 text-center text-primary-foreground">
          <p className="text-sm text-gold-soft">{formatDrawAt(live.month.draw_at)}</p>
          <p className="mt-1 flex items-center justify-center gap-2 font-mono text-3xl font-extrabold tabular-nums">
            <Timer className="size-6 text-gold-soft" /> {formatCountdown(live.msLeft)}
          </p>
        </div>
      )}
      {live.phase === "unscheduled" && (
        <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          The Admin will announce the draw date &amp; time soon.
        </p>
      )}
      {live.phase === "open" && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-gold-soft p-3 text-sm font-semibold text-accent-foreground">
          <Radio className="size-4 animate-pulse" /> The wheel is open now — the first member to spin decides{" "}
          {live.target ? deskLabel(live.target.event_no).en : ""}!
        </p>
      )}
      {live.phase === "spinning" && (
        <p className="font-ml mt-3 rounded-2xl bg-gold-soft p-3 text-sm font-semibold text-accent-foreground">
          ചക്രം കറക്കിയത്: {spinningBy}... ഫലത്തിനായി കാത്തിരിക്കുന്നു!
        </p>
      )}

      {winners.length > 0 && live.phase !== "spinning" && (
        <ul className="mt-3 space-y-1.5">
          {winners.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-soft/60 px-3 py-2 text-sm">
              <Crown className="size-4 text-gold" />
              <span className="font-ml text-accent-foreground">{deskLabel(e.event_no).ml}:</span>
              <span className="font-bold text-primary">{memberMap.get(e.recipient_member_id!)?.name}</span>
            </li>
          ))}
        </ul>
      )}

      {live.phase !== "done" && (
        <Button asChild variant={live.phase === "open" || live.phase === "alert" ? "gold" : "outline"} className="mt-3 w-full">
          <Link to="/draw">Open Live Wheel Arena</Link>
        </Button>
      )}
    </section>
  );
}
