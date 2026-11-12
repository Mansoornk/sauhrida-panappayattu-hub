import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, MessageCircle, RotateCcw, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { memberAccountsQuery, type Member } from "@/lib/queries";
import { useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { issueMemberCredentials } from "@/lib/payatt.functions";
import { suggestUsername } from "@/lib/payatt-rules";

type Issued = { member_id: string; name: string; username: string; temp_password: string; reset: boolean };

function shareText(i: Issued, origin: string) {
  return [
    "🌿 *Sauhrida Panappayattu* — your member login",
    `Name: ${i.name}`,
    `Username: *${i.username}*`,
    `Temporary password: *${i.temp_password}*`,
    "",
    `Open ${origin}/passbook and sign in. You'll be asked to set your own password.`,
  ].join("\n");
}

/** Admin: create usernames + temporary passwords, and reset forgotten ones. */
export function LoginsPanel() {
  const { members } = useSnapshot();
  const { token } = useRole();
  const qc = useQueryClient();
  const accounts = useQuery(memberAccountsQuery(token));
  const issue = useServerFn(issueMemberCredentials);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued[] | null>(null);
  const [creating, setCreating] = useState<Member | null>(null);
  const [username, setUsername] = useState("");

  const byMember = new Map((accounts.data ?? []).map((a) => [a.member_id, a]));
  const realMembers = members.filter((m) => !/^vacant/i.test(m.name));
  const missing = realMembers.filter((m) => !byMember.has(m.id));

  async function run(ids: string[], key: string, customUsername?: string) {
    if (!token) return;
    setBusy(key);
    try {
      const res = await issue({ data: { token, member_ids: ids, username: customUsername || undefined } });
      await qc.invalidateQueries({ queryKey: ["member-accounts"] });
      setIssued(res.issued);
      setCreating(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create login");
    } finally {
      setBusy(null);
    }
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-emerald-gradient p-5 text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">Member logins</p>
        <p className="mt-1 text-sm text-primary-foreground/85">
          {byMember.size} of {realMembers.length} members have a login. Each new or reset login gets a temporary
          password, and the member must change it on first sign-in.
        </p>
        <Button
          variant="gold"
          className="mt-3 w-full"
          disabled={missing.length === 0 || busy !== null}
          onClick={() => run(missing.map((m) => m.id), "all")}
        >
          {busy === "all" ? <Loader2 className="animate-spin" /> : <Users />} Create logins for{" "}
          {missing.length ? `all ${missing.length} without one` : "everyone (done)"}
        </Button>
      </div>

      <div className="rounded-3xl border bg-card p-3 shadow-card">
        {accounts.isLoading ? (
          <div className="grid place-items-center p-8">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((m) => {
              const acc = byMember.get(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 px-2 py-2">
                  <span className="w-6 text-xs font-bold text-muted-foreground">{m.slot_no}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    {acc ? (
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{acc.username}</span>
                        {acc.must_change_password ? (
                          <Badge variant="warning">Temporary password</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No login yet</p>
                    )}
                  </div>
                  {acc ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => {
                        if (confirm(`Reset ${m.name}'s password to a new temporary one?`)) run([m.id], m.id);
                      }}
                    >
                      {busy === m.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        setCreating(m);
                        setUsername(suggestUsername(m.name, m.slot_no));
                      }}
                    >
                      <UserPlus /> Create
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create login</DialogTitle>
            <DialogDescription>{creating?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="new-username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="new-username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, dot or underscore.</p>
          </div>
          <Button
            variant="gold"
            disabled={!creating || username.length < 3 || busy !== null}
            onClick={() => creating && run([creating.id], creating.id, username)}
          >
            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Create with temporary password
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Temporary passwords</DialogTitle>
            <DialogDescription>
              Share these now — they won't be shown again. Members must set their own password on first sign-in.
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText((issued ?? []).map((i) => `${i.name}\t${i.username}\t${i.temp_password}`).join("\n"))
                .then(() => toast.success("Copied"))
            }
          >
            <Copy /> Copy all
          </Button>
          <ul className="divide-y rounded-xl border">
            {(issued ?? []).map((i) => (
              <li key={i.member_id} className="flex items-center gap-2 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {i.name} {i.reset && <span className="text-xs text-muted-foreground">(reset)</span>}
                  </p>
                  <p className="font-mono text-xs">
                    {i.username} · <span className="font-semibold text-primary">{i.temp_password}</span>
                  </p>
                </div>
                <Button asChild size="icon" variant="ghost" aria-label={`Send ${i.name}'s login on WhatsApp`}>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText(i, origin))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle />
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
