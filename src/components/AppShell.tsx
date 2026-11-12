import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, Coffee, Disc3, HandCoins, LayoutDashboard } from "lucide-react";
import logo from "@/assets/sauhrida-logo.png.asset.json";
import { StaffLoginDialog } from "./StaffLoginDialog";
import { LiveDrawAlert } from "./live/LiveDrawAlert";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

const ROLE_LABEL = { member: "Member View", conductor: "Conductor Desk", admin: "Admin Mode" } as const;
const SHORT_LABEL = { member: "Member", conductor: "Conductor", admin: "Admin" } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { role, member } = useRole();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // A member signed in with a temporary password must set their own before anything else.
  useEffect(() => {
    if (member?.mustChange && pathname !== "/change-password") navigate({ to: "/change-password" });
  }, [member?.mustChange, pathname, navigate]);

  const nav = [
    { to: "/", label: "Pool", ml: "പൂൾ", icon: LayoutDashboard },
    { to: "/contribute", label: "Pay", ml: "അടവ്", icon: HandCoins },
    { to: "/passbook", label: "My Payattu", ml: "പാസ്ബുക്ക്", icon: BookOpen },
    { to: "/draw", label: "Draw", ml: "നറുക്ക്", icon: Disc3 },
    { to: "/tea", label: "Tea", ml: "ചായ", icon: Coffee },
    ...(role !== "member" ? [{ to: "/desk", label: "Desk", ml: "ഡെസ്ക്", icon: ClipboardCheck }] : []),
  ] as const;

  const chip = role === "member" && member ? member.name.replace(/^(dr|mr|mrs|ms|prof)\.?\s*/i, "").split(" ")[0] : null;

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="no-print bg-emerald-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
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
          <button
            type="button"
            aria-label={`Switch view (currently ${ROLE_LABEL[role]})`}
            onClick={() => setOpen(true)}
            className={cn(
              "max-w-[7.5rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              role === "member"
                ? "border-gold/60 bg-ivory/10 hover:bg-ivory/20"
                : "border-transparent bg-gold-gradient text-gold-foreground shadow-gold",
            )}
          >
            {chip ? (
              chip
            ) : (
              <>
                <span className="sm:hidden">{role === "member" ? "Sign in" : SHORT_LABEL[role]}</span>
                <span className="hidden sm:inline">{role === "member" ? "Member sign in" : ROLE_LABEL[role]}</span>
              </>
            )}
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

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-emerald-deep text-primary-foreground md:hidden">
        <div className="mx-auto flex max-w-lg">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="group flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-primary-foreground/65 data-[status=active]:text-gold-soft"
            >
              <n.icon className="size-5 transition-transform group-data-[status=active]:scale-110" />
              <span className="whitespace-nowrap font-medium">{n.label}</span>
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
