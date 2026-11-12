import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicSnapshotQuery } from "@/lib/queries";
import { playChime, useLiveDraw, useLiveDrawSync } from "@/lib/live-draw";
import { useRole } from "@/lib/role-context";
import { formatCountdown } from "@/lib/payatt-rules";

const LIVE_PHASES = new Set(["alert", "open", "spinning"]);

/** App-wide: 1-minute pre-draw pop-up + chime, and a "live now" bar while the draw runs. */
export function LiveDrawAlert() {
  useLiveDrawSync();
  const snap = useQuery({
    ...publicSnapshotQuery,
    // Poll quickly around the draw as a fallback to the live updates.
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 60_000;
      const now = Date.now() + d.clockOffset;
      const near = d.months.some((m) => m.draw_at && Math.abs(new Date(m.draw_at).getTime() - now) < 15 * 60_000);
      return near ? 4_000 : 60_000;
    },
  });
  const live = useLiveDraw(snap.data);
  const { role, member } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const chimed = useRef<string | null>(null);

  const signedIn = (member && !member.mustChange) || role !== "member";
  const drawKey = live?.month.draw_at ?? null;
  const showPopup = !!live && live.phase === "alert" && !!signedIn && pathname !== "/draw" && dismissed !== drawKey;

  useEffect(() => {
    if (live?.phase === "alert" && signedIn && drawKey && chimed.current !== drawKey) {
      chimed.current = drawKey;
      playChime();
    }
  }, [live?.phase, signedIn, drawKey]);

  if (!live) return null;

  if (showPopup) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-deep/60 p-4 backdrop-blur-sm sm:items-center">
        <div
          role="alertdialog"
          aria-labelledby="live-alert-title"
          className="relative w-full max-w-md animate-in slide-in-from-bottom-4 rounded-3xl border-2 border-gold bg-card p-5 text-center shadow-gold"
        >
          <button
            type="button"
            aria-label="Close alert"
            onClick={() => setDismissed(drawKey)}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
          <BellRing className="mx-auto size-10 animate-bounce text-gold" />
          <p id="live-alert-title" className="font-ml mt-3 text-base font-bold leading-relaxed text-primary">
            🔔 ശ്രദ്ധിക്കുക! ഭാഗ്യചക്ര നറുക്കെടുപ്പ് 1 മിനിറ്റിനകം ആരംഭിക്കുന്നു! ഇപ്പോൾ തന്നെ ലൈവായി പങ്കെടുക്കൂ.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The lucky wheel draw starts in{" "}
            <span className="font-mono font-bold text-primary">{formatCountdown(live.msLeft)}</span>
          </p>
          <Button asChild variant="gold" size="xl" className="mt-4 w-full">
            <Link to="/draw" onClick={() => setDismissed(drawKey)}>
              Join Live Draw Now
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (LIVE_PHASES.has(live.phase) && live.phase !== "alert" && pathname !== "/draw") {
    return (
      <Link
        to="/draw"
        className="no-print fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold bg-emerald-deep px-4 py-3 text-primary-foreground shadow-gold md:bottom-6"
      >
        <Radio className="size-5 shrink-0 animate-pulse text-gold" />
        <span className="flex-1 text-sm font-semibold">
          {live.phase === "spinning" ? "The lucky wheel is spinning now" : "Live lucky draw is open"}
        </span>
        <span className="rounded-full bg-gold-gradient px-3 py-1 text-xs font-bold text-gold-foreground">Join</span>
      </Link>
    );
  }
  return null;
}
