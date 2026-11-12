import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { MemberLoginForm } from "@/components/MemberLoginForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMemberPassword } from "@/lib/payatt.functions";
import { useRole } from "@/lib/role-context";
import { passwordProblem } from "@/lib/payatt-rules";

export const Route = createFileRoute("/change-password")({
  head: () => ({
    meta: [
      { title: "Change Password · Sauhrida Panappayattu" },
      { name: "description", content: "Set your own password for your Panappayattu member account." },
      { property: "og:title", content: "Change your Panappayattu password" },
      { property: "og:description", content: "Members set a private password before opening their dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { member, setMember, ready } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const change = useServerFn(changeMemberPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (!member) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-6 shadow-card">
        <PageTitle en="Member sign in" ml="അംഗം ലോഗിൻ" />
        <MemberLoginForm />
      </div>
    );
  }

  const problem = next ? passwordProblem(next) : null;
  const mismatch = confirm.length > 0 && confirm !== next;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!member) return;
    const p = passwordProblem(next);
    if (p) return void toast.error(p);
    if (next !== confirm) return void toast.error("The two new passwords don't match");
    setBusy(true);
    try {
      const res = await change({ data: { token: member.token, current, next } });
      setMember({ ...member, token: res.token, exp: res.exp, mustChange: false });
      qc.removeQueries({ queryKey: ["my-dashboard"] });
      toast.success("Password changed");
      navigate({ to: "/passbook" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle en="Change Password" ml="പാസ്‌വേഡ് മാറ്റുക" />
      <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-card p-5 shadow-card">
        {member.mustChange && (
          <div className="flex gap-2 rounded-2xl border border-gold/40 bg-gold-soft p-3 text-sm text-accent-foreground">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            <span>
              Hi {member.name}. You signed in with a temporary password. Set your own password to open your
              dashboard.
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cp-cur">{member.mustChange ? "Temporary password" : "Current password"}</Label>
          <Input
            id="cp-cur"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-new">New password</Label>
          <Input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="h-11"
            aria-invalid={!!problem}
          />
          <p className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {problem ?? "At least 8 characters, with letters and numbers."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-confirm">Confirm new password</Label>
          <Input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11"
            aria-invalid={mismatch}
          />
          {mismatch && <p className="text-xs text-destructive">Passwords don't match.</p>}
        </div>
        <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy || !current || !next || !confirm}>
          {busy && <Loader2 className="animate-spin" />} Save new password
        </Button>
      </form>
    </div>
  );
}
