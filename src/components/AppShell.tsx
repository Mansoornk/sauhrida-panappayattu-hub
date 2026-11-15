import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ClipboardCheck, Coffee, Disc3, HandCoins, LayoutDashboard, Loader2, UserCheck } from "lucide-react";
import logo from "@/assets/sauhrida-logo.png.asset.json";
import { StaffLoginDialog } from "./StaffLoginDialog";
import { LiveDrawAlert } from "./live/LiveDrawAlert";
import { DrawAlertsBell } from "./live/DrawAlertsToggle";
import { Landing } from "./landing/Landing";
import { Button } from "./ui/button";
import { useRole } from "@/lib/role-context";
import { snapshotQuery } from "@/lib/queries";
import { useSnapshot } from "@/lib/use-payatt";
import { conductorDeskEvents, todayIST } from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <img src={logo.url} alt="" className="size-16 animate-pulse rounded-full" />
        <p className="font-ml text-sm">സൗഹൃദ പണപ്പയറ്റ്</p>
      </div>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="grid place-items-center py-20 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

/**
 * The whole app sits behind sign-in: visitors see the introduction page, a member still on a
 * temporary password sees only the password change page, everyone else gets the full app.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { ready, member, viewerToken, role, logout, logoutMember } = useRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const snap = useQuery({ ...snapshotQuery(viewerToken), enabled: !!viewerToken });

  // A member signed in with a temporary password must set their own before anything else.
  useEffect(() => {
    if (member?.mustChange && pathname !== "/change-password") navigate({ to: "/change-password" });
  }, [member?.mustChange, pathname, navigate]);

  // An expired sign-in drops back to the sign-in page instead of an error.
  const err = snap.error?.message ?? "";
  useEffect(() => {
    if (!/sign in again|log in again|session has expired/i.test(err)) return;
    if (role === "admin") logout();
    else logoutMember();
  }, [err, role, logout, logoutMember]);

  if (!ready) return <Splash />;
  if (member?.mustChange && role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-5xl px-4 py-8">{pathname === "/change-password" ? children : <PageLoading />}</main>
      </div>
    );
  }
  if (!viewerToken) return <Landing />;
  if (snap.isPending) return <Splash />;
  if (snap.isError) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <p className="font-semibold text-primary">Couldn't load the Payattu</p>
          <p className="text-sm text-muted-foreground">{err}</p>
          <Button onClick={() => snap.refetch()}>Try again</Button>
        </div>
      </div>
    );
  }
  return <SignedInShell>{children}</SignedInShell>;
}

function SignedInShell({ children }: { children: ReactNode }) {
  const { role, member } = useRole();
  const { events } = useSnapshot();
  const [open, setOpen] = useState(false);
  const isConductor = useMemo(
    () => conductorDeskEvents(events, member?.memberId, todayIST()).length > 0,
    [events, member?.memberId],
  );

  const nav = [
    { to: "/", label: "Pool", ml: "പൂൾ", icon: LayoutDashboard },
    { to: "/contribute", label: "Pay", ml: "അടവ്", icon: HandCoins },
    { to: "/passbook", label: "My Payattu", ml: "പാസ്ബുക്ക്", icon: BookOpen },
    { to: "/draw", label: "Draw", ml: "നറുക്ക്", icon: Disc3 },
    { to: "/tea", label: "Tea", ml: "ചായ", icon: Coffee },
    ...(isConductor ? [{ to: "/conductor", label: "Conductor", ml: "നടത്തിപ്പ്", icon: UserCheck } as const] : []),
    ...(role === "admin" ? [{ to: "/desk", label: "Admin", ml: "അഡ്മിൻ", icon: ClipboardCheck } as const] : []),
  ] as const;

  const chip = member ? member.name.replace(/^(dr|mr|mrs|ms|prof)\.?\s*/i, "").split(" ")[0] : "Admin";

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="no-print bg-emerald-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
            <img
              src={logo.url}
              alt="Sauhrida Panappayattu emblem"
              className="size-12 shrink-0 rounded-full ring-2 ring-gold/70 sm:size-14"
            />
            <div className="min-w-0">
              <p className="font-ml text-base font-bold leading-tight sm:text-lg">സൗഹൃദ പണപ്പയറ്റ്</p>
              <p className="text-[10px] font-medium leading-snug tracking-wide text-gold-soft sm:text-[11px]">
                36 Hearts, Zero Interest, Infinite Brotherhood
              </p>
            </div>
          </Link>
          <DrawAlertsBell />
          <button
            type="button"
            aria-label="Account and sign in"
            onClick={() => setOpen(true)}
            className={cn(
              "max-w-[7.5rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              role === "admin"
                ? "border-transparent bg-gold-gradient text-gold-foreground shadow-gold"
                : "border-gold/60 bg-ivory/10 hover:bg-ivory/20",
            )}
          >
            {role === "admin" && member ? `${chip} · Admin` : chip}
          </button>
        </div>
        <div className="mx-auto max-w-5xl px-4">
          <div className="gold-rule" />
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 py-2 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-primary-foreground/80 transition-colors hover:bg-ivory/10 data-[status=active]:bg-ivory/15 data-[status=active]:text-primary-foreground"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </main>

      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-emerald-deep text-primary-foreground md:hidden">
        <div className="mx-auto flex max-w-lg">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="group flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-primary-foreground/65 data-[status=active]:text-gold-soft"
            >
              <n.icon className="size-5 transition-transform group-data-[status=active]:scale-110" />
              <span className="max-w-full truncate whitespace-nowrap font-medium">{n.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <StaffLoginDialog open={open} onOpenChange={setOpen} />
      <LiveDrawAlert />
    </div>
  );
}

export function PageTitle({ en, ml, children }: { en: string; ml: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">{en}</h1>
        <p className="font-ml text-sm text-accent-foreground">{ml}</p>
      </div>
      {children}
    </div>
  );
}
