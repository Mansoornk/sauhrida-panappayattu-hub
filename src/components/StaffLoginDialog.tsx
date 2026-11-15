import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberLoginForm } from "@/components/MemberLoginForm";
import { DrawAlertsCard } from "@/components/live/DrawAlertsToggle";
import { loginStaff } from "@/lib/payatt.functions";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

type Choice = "member" | "admin";

const OPTIONS: { id: Choice; title: string; ml: string; icon: typeof UserRound; hint: string }[] = [
  { id: "member", title: "Member sign in", ml: "അംഗം", icon: UserRound, hint: "Username & password from the Admin" },
  { id: "admin", title: "Admin Mode", ml: "അഡ്മിൻ", icon: ShieldCheck, hint: "Admin PIN" },
];

/** Sign-in and account box: members use username + password, the Admin uses a PIN. */
export function StaffLoginDialog({
  open,
  onOpenChange,
  initial = "member",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Choice;
}) {
  const { role, setSession, logout, member, logoutMember, viewerToken } = useRole();
  const [choice, setChoice] = useState<Choice>(role === "admin" ? "admin" : initial);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useServerFn(loginStaff);
  const qc = useQueryClient();

  function signOutMember() {
    logoutMember();
    qc.removeQueries({ queryKey: ["my-dashboard"] });
    qc.removeQueries({ queryKey: ["conductor-desk"] });
    toast.success("Signed out");
  }

  function leaveAdmin() {
    logout();
    qc.removeQueries({ queryKey: ["desk"] });
    qc.removeQueries({ queryKey: ["member-accounts"] });
    toast.success("Left Admin Mode");
  }

  async function submitPin() {
    setBusy(true);
    try {
      const res = await login({ data: { role: "admin", pin } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSession({ role: "admin", token: res.token, exp: res.exp });
      toast.success("Admin Mode unlocked");
      setPin("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Sign in · <span className="font-ml">ലോഗിൻ ചെയ്യുക</span>
          </DialogTitle>
          <DialogDescription>Members sign in with the username the Admin gave them.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setChoice(o.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors",
                choice === o.id ? "border-gold bg-gold-soft" : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className="grid size-9 place-items-center rounded-full bg-emerald-gradient text-primary-foreground">
                <o.icon className="size-4" />
              </span>
              <span className="text-sm font-semibold">{o.title}</span>
              <span className="text-[11px] text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>

        {choice === "member" ? (
          member ? (
            <div className="space-y-3 rounded-xl border bg-muted p-3">
              <p className="text-sm">
                Signed in as <span className="font-semibold">{member.name}</span>
              </p>
              {viewerToken && <DrawAlertsCard />}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => onOpenChange(false)}>
                  Continue
                </Button>
                <Button variant="outline" onClick={signOutMember}>
                  <LogOut /> Sign out
                </Button>
              </div>
            </div>
          ) : (
            <MemberLoginForm onDone={() => onOpenChange(false)} />
          )
        ) : role === "admin" ? (
          <div className="space-y-2 rounded-xl border bg-muted p-3">
            <p className="text-sm font-semibold">Admin Mode is on</p>
            <Button variant="outline" className="w-full" onClick={leaveAdmin}>
              <LogOut /> Leave Admin Mode
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="pin" className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="size-3.5" /> Admin PIN
              </label>
              <Input
                id="pin"
                inputMode="numeric"
                type="password"
                autoComplete="off"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && submitPin()}
                className="h-12 text-center text-xl tracking-[0.5em]"
                placeholder="••••"
              />
            </div>
            <Button variant="gold" size="xl" disabled={busy || pin.length < 4} onClick={submitPin}>
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
