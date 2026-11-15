import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ImagePlus, Info, Loader2, X } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { MemberSelect } from "@/components/MemberSelect";
import { MemberLoginForm } from "@/components/MemberLoginForm";
import { SelectionBadge } from "@/components/EventCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { myDashboardQuery, SNAPSHOT_KEY } from "@/lib/queries";
import { useActiveMonth, useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { submitContribution } from "@/lib/payatt.functions";
import { compressScreenshot } from "@/lib/image-compress";
import { formatINR, formatMonth, isValidAmount, isValidUtr, MIN_CONTRIBUTION } from "@/lib/payatt-rules";
import { deskLabel } from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contribute")({
  head: () => ({
    meta: [
      { title: "Submit Contribution · Sauhrida Panappayattu" },
      {
        name: "description",
        content: "Give to each Payattu recipient separately — ₹2,500 or more per recipient, your own amount.",
      },
      { property: "og:title", content: "Submit your Payattu contribution" },
      { property: "og:description", content: "Choose the recipient, enter your amount. UTR and screenshot are optional." },
    ],
  }),
  component: ContributePage,
});

function ContributePage() {
  const { members, events } = useSnapshot();
  const { monthKey } = useActiveMonth();
  const memberMap = useMemberMap();
  const { role, token, member, logoutMember, ready } = useRole();
  const submit = useServerFn(submitContribution);
  const qc = useQueryClient();
  const staff = role !== "member";
  const mine = useQuery({ ...myDashboardQuery(member?.token ?? null), enabled: !staff && !!member && !member.mustChange });

  const monthOptions = useMemo(() => {
    const set = new Set(events.map((e) => e.month));
    return [...set].sort().reverse();
  }, [events]);
  const [month, setMonth] = useState(monthOptions.includes(monthKey) ? monthKey : (monthOptions[0] ?? monthKey));
  const monthEvents = events.filter((e) => e.month === month).sort((a, b) => a.event_no - b.event_no);

  const [memberId, setMemberId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(MIN_CONTRIBUTION));
  const [method, setMethod] = useState<"upi" | "cash">("upi");
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [shot, setShot] = useState<{ base64: string; type: "image/jpeg"; bytes: number; previewUrl: string } | null>(
    null,
  );
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ recipient: string; amount: number } | null>(null);

  useEffect(() => {
    if (mine.error && /sign in again/i.test(mine.error.message)) {
      logoutMember();
      toast.error("Please sign in again");
    }
  }, [mine.error, logoutMember]);

  const giverId = staff ? memberId : (member?.memberId ?? null);
  const alreadyGiven = new Set(
    (mine.data?.contributions ?? []).filter((c) => c.status !== "rejected").map((c) => c.event_id),
  );
  const isBlocked = (e: (typeof monthEvents)[number]) =>
    (!!giverId && e.recipient_member_id === giverId) || (!staff && alreadyGiven.has(e.id));

  useEffect(() => {
    const first = monthEvents.find((e) => !isBlocked(e));
    if (!eventId || !monthEvents.some((e) => e.id === eventId && !isBlocked(e))) setEventId(first?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, giverId, mine.data, events]);

  const amt = Number(amount);
  const amountOk = isValidAmount(amt);
  const utrOk = method === "cash" || isValidUtr(utr);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    try {
      setShot(await compressScreenshot(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process image");
    } finally {
      setCompressing(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (staff && !memberId) return void toast.error("Please choose the member's name");
    if (!eventId) return void toast.error("Choose which recipient you're giving to");
    if (!amountOk) return void toast.error(`Minimum is ${formatINR(MIN_CONTRIBUTION)} per recipient`);
    if (!utrOk) return void toast.error("UTR must be exactly 12 digits, or leave it empty");
    setBusy(true);
    try {
      await submit({
        data: {
          event_id: eventId,
          member_id: staff ? memberId! : undefined,
          amount: amt,
          utr: method === "upi" ? utr.trim() || undefined : undefined,
          payment_method: method,
          note: note.trim() || undefined,
          screenshot: shot ? { base64: shot.base64, type: shot.type } : undefined,
          token: token ?? undefined,
          member_token: staff ? undefined : member?.token,
        },
      });
      const ev = monthEvents.find((x) => x.id === eventId);
      const recipient = ev?.recipient_member_id ? memberMap.get(ev.recipient_member_id)?.name : null;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["desk"] }),
        qc.invalidateQueries({ queryKey: ["my-dashboard"] }),
        qc.invalidateQueries({ queryKey: SNAPSHOT_KEY }),
      ]);
      setUtr("");
      setNote("");
      setShot(null);
      if (staff) {
        toast.success("Saved as verified draft — awaiting Admin publish");
        setMemberId(null);
      } else {
        setDone({ recipient: recipient ?? (ev ? deskLabel(ev.event_no).en : "the desk"), amount: amt });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  if (!staff && !member) {
    return (
      <div className="mx-auto max-w-md">
        <PageTitle en="Submit Contribution" ml="അടവ് സമർപ്പിക്കുക" />
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <p className="mb-4 text-sm text-muted-foreground">
            Sign in with the username and password the Admin gave you to record your contribution.
          </p>
          <MemberLoginForm />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-4 text-xl font-bold text-primary">Submitted — thank you!</h1>
        <p className="font-ml mt-1 text-sm text-accent-foreground">നന്ദി! നിങ്ങളുടെ അടവ് ലഭിച്ചു</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {formatINR(done.amount)} to {done.recipient}. The Conductors will verify it, and it counts once the Admin
          publishes this month's ledger.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => setDone(null)}>
          Give to another recipient
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle
        en={staff ? "Enter Contribution" : "Submit Contribution"}
        ml={staff ? "അംഗത്തിന് വേണ്ടി അടവ് രേഖപ്പെടുത്തുക" : "പ്രതിമാസ അടവ്"}
      />

      {staff ? (
        <div className="mb-4 flex gap-2 rounded-2xl border border-gold/40 bg-gold-soft p-3 text-sm text-accent-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          You're entering on behalf of a member. It's saved as verified, but stays hidden as a draft until the Admin
          publishes the ledger.
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          Giving as <span className="font-semibold text-foreground">{member?.name}</span>. When a month has two
          recipients, give to each one separately — the amounts can be different.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border bg-card p-5 shadow-card">
        {staff && (
          <div className="space-y-2">
            <Label htmlFor="member">
              Member name <span className="text-destructive">*</span>
            </Label>
            <MemberSelect id="member" members={members} value={memberId} onChange={setMemberId} />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <select
            id="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {(monthOptions.length ? monthOptions : [monthKey]).map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            Recipient <span className="text-destructive">*</span>
          </legend>
          {monthEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No Payattu is set up for this month yet.
            </p>
          ) : (
            monthEvents.map((e) => {
              const r = e.recipient_member_id ? memberMap.get(e.recipient_member_id) : undefined;
              const blocked = isBlocked(e);
              const given = !staff && alreadyGiven.has(e.id);
              return (
                <label
                  key={e.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                    eventId === e.id ? "border-gold bg-gold-soft" : "bg-background hover:bg-muted",
                    blocked && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="event"
                    className="accent-[var(--gold)]"
                    checked={eventId === e.id}
                    disabled={blocked}
                    onChange={() => setEventId(e.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">{deskLabel(e.event_no).en}</span>
                    <span className="block truncate font-semibold">{r?.name ?? "Recipient not decided yet"}</span>
                    {given && <span className="text-xs text-success">You've already given to this recipient</span>}
                    {!!giverId && e.recipient_member_id === giverId && (
                      <span className="text-xs text-muted-foreground">This is your own Payattu</span>
                    )}
                  </span>
                  <SelectionBadge type={e.selection_type} />
                </label>
              );
            })
          )}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="amount">
            Amount to this recipient (₹) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            className="h-11 text-lg font-semibold"
            aria-invalid={!amountOk}
          />
          <p className={amountOk ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
            Minimum {formatINR(MIN_CONTRIBUTION)} · no upper limit
          </p>
        </div>

        <div className="space-y-2">
          <Label>Paid by</Label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
            {(["upi", "cash"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors",
                  method === m ? "border-gold bg-gold-soft text-accent-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {m === "upi" ? "UPI" : "Cash · പണം"}
              </button>
            ))}
          </div>
        </div>

        {method === "upi" && (
        <div className="space-y-2">
            <Label htmlFor="utr">
              12-digit UPI UTR number <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="utr"
              inputMode="numeric"
              maxLength={12}
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 412345678901"
              className="h-11 tracking-widest"
              aria-invalid={!utrOk}
            />
            {!utrOk && <p className="text-xs text-destructive">UTR must be exactly 12 digits.</p>}
          </div>
        )}

        <div className="space-y-2">
          <Label>
            Receipt / payment screenshot <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </Label>
          {shot ? (
            <div className="relative overflow-hidden rounded-xl border">
              <img src={shot.previewUrl} alt="Payment screenshot preview" className="max-h-64 w-full object-contain" />
              <div className="flex items-center justify-between border-t bg-muted px-3 py-2 text-xs text-muted-foreground">
                Compressed to {Math.round(shot.bytes / 1024)} KB
                <Button type="button" variant="ghost" size="sm" onClick={() => setShot(null)}>
                  <X /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold/40 bg-background p-6 text-center text-sm text-muted-foreground hover:bg-muted">
              {compressing ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6 text-gold" />}
              {compressing ? "Compressing…" : "Tap to add a screenshot"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">
            Note <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        <Button
          type="submit"
          variant="gold"
          size="xl"
          className="w-full"
          disabled={busy || compressing || !eventId}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {staff ? "Save verified entry" : `Submit ${amountOk ? formatINR(amt) : ""}`}
        </Button>
      </form>
    </div>
  );
}
