import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginMember } from "@/lib/payatt.functions";
import { useRole } from "@/lib/role-context";

/** Username + password sign-in for members. First sign-in goes to the mandatory change-password screen. */
export function MemberLoginForm({ onDone }: { onDone?: () => void }) {
  const { setMember } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const login = useServerFn(loginMember);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const res = await login({ data: { username: username.trim(), password } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMember({ token: res.token, exp: res.exp, memberId: res.memberId, name: res.name, mustChange: res.mustChange });
      qc.removeQueries({ queryKey: ["my-dashboard"] });
      setPassword("");
      onDone?.();
      if (res.mustChange) {
        toast.info("Please set your own password to continue");
        navigate({ to: "/change-password" });
      } else {
        toast.success(`Welcome, ${res.name}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="m-user">Username</Label>
        <Input
          id="m-user"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-pass">Password</Label>
        <Input
          id="m-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
      </div>
      <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy || !username || !password}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Forgot your password? Ask the Admin to reset it.
      </p>
    </form>
  );
}
