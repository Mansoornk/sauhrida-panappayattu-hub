import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SNAPSHOT_KEY, type Snapshot } from "./queries";
import { liveDrawPhase, todayIST } from "./payatt-rules";

/** Ticking clock; null until mounted so server and browser render the same HTML. */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * The month members should watch for the live draw: the earliest upcoming month
 * with a lottery desk, preferring one whose draw time is already announced.
 */
function pickLiveMonth(snap: Snapshot, today: string) {
  const lotteryMonths = new Set(snap.events.filter((e) => e.selection_type === "lottery").map((e) => e.month));
  const upcoming = snap.months
    .filter((m) => lotteryMonths.has(m.month) && m.payatt_date >= today)
    .sort((a, b) => a.payatt_date.localeCompare(b.payatt_date));
  return upcoming.find((m) => m.draw_at || m.wheel_override) ?? upcoming[0] ?? null;
}

export function computeLive(snap: Snapshot, now: number) {
  const month = pickLiveMonth(snap, todayIST(new Date(now)));
  if (!month) return null;
  const events = snap.events.filter((e) => e.month === month.month).sort((a, b) => a.event_no - b.event_no);
  const draws = snap.liveDraws.filter((d) => d.month === month.month).sort((a, b) => a.event_no - b.event_no);
  const state = liveDrawPhase({ now, drawAt: month.draw_at, override: month.wheel_override, events, draws });
  return { month, events, draws, now, ...state };
}

export type LiveState = NonNullable<ReturnType<typeof computeLive>>;

export function useLiveDraw(snap: Snapshot | undefined): LiveState | null {
  const now = useNow(1000);
  return useMemo(() => (snap && now !== null ? computeLive(snap, now + snap.clockOffset) : null), [snap, now]);
}

/** Refreshes everyone's data the instant a live spin is claimed or a desk changes. Mount once. */
export function useLiveDrawSync() {
  const qc = useQueryClient();
  useEffect(() => {
    // Data-free "something changed" doorbell; the data itself is re-read through the signed-in API.
    const channel = supabase
      .channel("payatt-live")
      .on("broadcast", { event: "changed" }, () => {
        void qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}

/** Short bell-like chime (Web Audio, no sound file). */
export function playChime() {
  try {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();
    const notes = [880, 1175, 1568, 880, 1175, 1568];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22 + (i >= 3 ? 0.4 : 0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => void ctx.close(), 3500);
  } catch {
    // Sound is a nice-to-have; the pop-up still shows.
  }
}
