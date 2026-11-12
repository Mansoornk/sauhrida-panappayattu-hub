import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Lock, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberLoginForm } from "@/components/MemberLoginForm";
import { loginStaff } from "@/lib/payatt.functions";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

type Choice = "member" | "conductor" | "admin";

const OPTIONS: { id: Choice; title: string; ml: string; icon: typeof Eye; hint: string }[] = [
  { id: "member", title: "Member View", ml: "അംഗം", icon: Eye, hint: "Sign in to see your own contributions" },
  { id: "conductor", title: "Conductor Desk", ml: "നടത്തിപ്പുകാർ", icon: UserRound, hint: "Enter & verify payments" },
  { id: "admin", title: "Admin Mode", ml: "അഡ്മിൻ", icon: ShieldCheck, hint: "Publish, draw, logins & export" },
];

export function StaffLoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { role, setSession, logout, member, logoutMember } = useRole();
  const [choice, setChoice] = useState<Choice>(role);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useServerFn(loginStaff);
  const qc = useQueryClient();

  function toMemberView() {
    if (role !== "member") {
      logout();
      qc.removeQueries({ queryKey: ["desk"] });
      qc.removeQueries({ queryKey: ["member-accounts"] });
      toast.success("Switched to Member View");
    }
    onOpenChange(false);
  }

  async function submitPin() {
    setBusy(true);
    try {
      const res = await login({ data: { role: choice as "admin" | "conductor", pin } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSession({ role: res.role, token: res.token, exp: res.exp });
      toast.success(res.role === "admin" ? "Admin Mode unlocked" : "Conductor Desk unlocked");
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
          <DialogTitle>Choose your view</DialogTitle>
          <DialogDescription>Members sign in with a username. Conductor and Admin use a PIN.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setChoice(o.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                choice === o.id ? "border-gold bg-gold-soft" : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className="grid size-10 place-items-center rounded-full bg-emerald-gradient text-primary-foreground">
                <o.icon className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">
                  {o.title} <span className="font-ml text-xs font-normal text-muted-foreground">· {o.ml}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {choice === "member" ? (
          member ? (
            <div className="space-y-2 rounded-xl border bg-muted p-3">
              <p className="text-sm">
                Signed in as <span className="font-semibold">{member.name}</span>
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={toMemberView}>
                  Continue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    logoutMember();
                    qc.removeQueries({ queryKey: ["my-dashboard"] });
                    toast.success("Signed out");
                  }}
                >
                  <LogOut /> Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <MemberLoginForm onDone={toMemberView} />
              <Button variant="ghost" className="w-full" onClick={toMemberView}>
                Just browse without signing in
              </Button>
            </div>
          )
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="pin" className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="size-3.5" /> {choice === "admin" ? "Admin" : "Conductor"} PIN
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
