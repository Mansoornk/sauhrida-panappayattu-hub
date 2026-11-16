import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ClipboardCheck, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { MemberSelect } from "@/components/MemberSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { conductorDeskQuery, SNAPSHOT_KEY, type ConductorDesk } from "@/lib/queries";
import { useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { reviewContribution, submitContribution } from "@/lib/payatt.functions";
import { deskLabel, formatINR, formatMonth, isValidAmount, isValidUtr, MIN_CONTRIBUTION } from "@/lib/payatt-rules";

export const Route = createFileRoute("/conductor")({
  head: () => ({
    meta: [
      { title: "Conductor Desk · സൗഹൃദ പണപ്പയറ്റ്" },
      { name: "description", content: "Your own Payattu Desk: verify members' payments and add cash or UPI entries." },
      { property: "og:title", content: "Conductor Desk · നടത്തിപ്പുകാരുടെ ഡെസ്ക്" },
      { property: "og:description", content: "Verify and record contributions for your Payattu Desk." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConductorPage,
});

function ConductorPage() {
  const { member } = useRole();
  const desk = useQuery(conductorDeskQuery(member && !member.mustChange ? member.token : null));

  if (!member) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        Sign in as a member to open your Conductor Desk.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle en="Conductor Desk" ml="നടത്തിപ്പുകാരുടെ ഡെസ്ക്" />
      {desk.isLoading ? (
        <div className="grid place-items-center p-10">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      ) : desk.error ? (
        <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{desk.error.message}</p>
      ) : !desk.data || desk.data.events.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <ClipboardCheck className="mx-auto mb-2 size-8 text-gold" />
          You're not conducting a Payattu Desk right now. When you're a desk's recipient, its ledger appears here.
        </div>
      ) : (
        desk.data.events.map((e) => <DeskLedger key={e.id} event={e} rows={desk.data!.contributions.filter((c) => c.event_id === e.id)} />)
      )}
    </div>
  );
}

type DeskEvent = ConductorDesk["events"][number];
type Row = ConductorDesk["contributions"][number];

function DeskLedger({ event, rows }: { event: DeskEvent; rows: Row[] }) {
  const { member } = useRole();
  const memberMap = useMemberMap();
  const qc = useQueryClient();
  const review = useServerFn(reviewContribution);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const live = rows.filter((r) => r.status !== "rejected");
  const pending = rows.filter((r) => r.status === "pending");
  const verified = rows.filter((r) => r.status === "verified");
  const sum = (a: Row[]) => a.reduce((s, r) => s + r.amount, 0);

  async function act(id: string, action: "verify" | "reject") {
    if (!member) return;
    setBusyId(id);
    try {
      await review({ data: { member_token: member.token, id, action } });
      await qc.invalidateQueries({ queryKey: ["conductor-desk"] });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-gold/50 bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
            {deskLabel(event.event_no).en} · <span className="font-ml normal-case">{deskLabel(event.event_no).ml}</span>
          </p>
          <h2 className="text-lg font-bold text-primary">{formatMonth(event.month)}</h2>
        </div>
        <Button size="sm" variant="gold" onClick={() => setAdding((v) => !v)}>
          <Plus /> Add cash / UPI entry
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-warning-soft p-2 text-warning">
          <p className="text-xl font-bold">{pending.length}</p>
          <p className="text-[11px]">To verify · {formatINR(sum(pending))}</p>
        </div>
        <div className="rounded-2xl bg-success-soft p-2 text-success">
          <p className="text-xl font-bold">{verified.length}</p>
          <p className="text-[11px]">Verified · {formatINR(sum(verified))}</p>
        </div>
        <div className="rounded-2xl bg-gold-soft p-2 text-accent-foreground">
          <p className="text-xl font-bold">{formatINR(sum(live))}</p>
          <p className="text-[11px]">Desk total so far</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Only your own desk is shown. Verified entries go live once the Admin publishes the ledger.
      </p>

      {adding && <AddEntry event={event} taken={new Set(live.map((r) => r.member_id))} onDone={() => setAdding(false)} />}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const m = memberMap.get(r.member_id);
            return (
              <li key={r.id} className="rounded-2xl border p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{m?.name ?? "Member"}</p>
                      {r.status === "pending" ? (
                        <Badge variant="warning">To verify</Badge>
                      ) : r.status === "rejected" ? (
                        <Badge variant="destructive">Rejected</Badge>
                      ) : r.published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="gold">Verified</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.payment_method === "cash" ? "Cash" : r.payment_method === "upi" ? "UPI" : "Payment"}
                      {r.utr ? ` · UTR ${r.utr}` : ""} · by {r.entered_by}
                    </p>
                    {r.note && <p className="mt-1 text-xs italic text-muted-foreground">“{r.note}”</p>}
                  </div>
                  <p className="text-lg font-bold text-primary">{formatINR(r.amount)}</p>
                </div>
                {!r.published && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.screenshot_url && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={r.screenshot_url} target="_blank" rel="noreferrer">
                          <ImageIcon /> Screenshot
                        </a>
                      </Button>
                    )}
                    <div className="ml-auto flex gap-2">
                      {r.status !== "verified" && (
                        <Button size="sm" disabled={busyId === r.id} onClick={() => act(r.id, "verify")}>
                          <Check /> Verify
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "reject")}>
                          <X /> Reject
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AddEntry({ event, taken, onDone }: { event: DeskEvent; taken: Set<string>; onDone: () => void }) {
  const { member } = useRole();
  const { members } = useSnapshot();
  const qc = useQueryClient();
  const submit = useServerFn(submitContribution);
  const options = useMemo(
    () => members.filter((m) => m.id !== event.recipient_member_id && !taken.has(m.id)),
    [members, event.recipient_member_id, taken],
  );
  const [giver, setGiver] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(MIN_CONTRIBUTION));
  const [method, setMethod] = useState<"cash" | "upi">("cash");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const amt = Number(amount);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!member || !giver) return void toast.error("Choose the member");
    if (!isValidAmount(amt)) return void toast.error(`Minimum is ${formatINR(MIN_CONTRIBUTION)}`);
    if (method === "upi" && !isValidUtr(utr)) return void toast.error("UTR must be exactly 12 digits, or leave it empty");
    setBusy(true);
    try {
      await submit({
        data: {
          event_id: event.id,
          member_id: giver,
          amount: amt,
          payment_method: method,
          utr: method === "upi" ? utr.trim() || undefined : undefined,
          member_token: member.token,
          as_conductor: true,
        },
      });
      await qc.invalidateQueries({ queryKey: ["conductor-desk"] });
      toast.success("Entry saved as verified");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl bg-muted p-3">
      <div className="space-y-1.5">
        <Label>Member</Label>
        <MemberSelect members={options} value={giver} onChange={setGiver} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-amt">Amount (min {formatINR(MIN_CONTRIBUTION)})</Label>
          <Input id="c-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="space-y-1.5">
          <Label>Method</Label>
          <div className="grid grid-cols-2 gap-1">
            {(["cash", "upi"] as const).map((m) => (
              <Button key={m} type="button" variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>
                {m === "cash" ? "Cash" : "UPI"}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {method === "upi" && (
        <div className="space-y-1.5">
          <Label htmlFor="c-utr">UTR (optional, 12 digits)</Label>
          <Input id="c-utr" inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} />
        </div>
      )}
      <Button type="submit" variant="gold" className="w-full" disabled={busy || !giver || !isValidAmount(amt)}>
        {busy ? <Loader2 className="animate-spin" /> : <Check />} Save entry
      </Button>
    </form>
  );
}
