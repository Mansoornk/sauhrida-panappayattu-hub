import { useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useDrawAlerts } from "@/lib/draw-alerts";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

const LABEL_ML = "🔔 നറുക്കെടുപ്പ് അലർട്ടുകൾ ഓൺ ചെയ്യുക";

function useToggle() {
  const { viewerToken } = useRole();
  const alerts = useDrawAlerts(viewerToken);
  const [busy, setBusy] = useState(false);
  async function toggle(next: boolean) {
    if (alerts.support === "ios-install") {
      toast.info("On iPhone, first add this app to your Home Screen (Share → Add to Home Screen), then open it from there.");
      return;
    }
    if (alerts.support === "unsupported") {
      toast.error("This browser can't show draw alerts. Try Chrome on Android, or the app added to your iPhone Home Screen.");
      return;
    }
    setBusy(true);
    try {
      if (next) {
        await alerts.enable();
        toast.success("Draw alerts are on. You'll get a notification 1 minute before the live draw.");
      } else {
        await alerts.disable();
        toast.success("Draw alerts are off on this phone");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change draw alerts");
    } finally {
      setBusy(false);
    }
  }
  return { ...alerts, busy, toggle };
}

/** Small bell in the top bar. */
export function DrawAlertsBell() {
  const t = useToggle();
  const Icon = t.busy ? Loader2 : t.on ? BellRing : t.support === "supported" ? Bell : BellOff;
  return (
    <button
      type="button"
      onClick={() => t.toggle(!t.on)}
      disabled={t.busy || t.loading}
      aria-pressed={t.on}
      aria-label={t.on ? "Draw alerts are on. Tap to turn off" : "Enable Draw Alerts"}
      title={t.on ? "Draw alerts on" : "Enable Draw Alerts"}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border transition-colors",
        t.on ? "border-transparent bg-gold-gradient text-gold-foreground shadow-gold" : "border-gold/60 bg-ivory/10 hover:bg-ivory/20",
      )}
    >
      <Icon className={cn("size-4", t.busy && "animate-spin")} />
    </button>
  );
}

/** Full switch row for the member profile. */
export function DrawAlertsCard({ className }: { className?: string }) {
  const t = useToggle();
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold-soft p-3", className)}>
      <BellRing className="size-5 shrink-0 text-accent-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-ml text-sm font-semibold text-accent-foreground">{LABEL_ML}</p>
        <p className="text-xs text-muted-foreground">
          Enable Draw Alerts — a phone notification 1 minute before the live lucky wheel draw.
          {t.support === "ios-install" && " On iPhone, add the app to your Home Screen first."}
        </p>
      </div>
      {t.busy ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <Switch checked={t.on} onCheckedChange={t.toggle} disabled={t.loading} aria-label="Enable Draw Alerts" />
      )}
    </div>
  );
}
