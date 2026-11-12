import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MyDashboard } from "@/lib/queries";
import { useCycleMonthOptions } from "@/lib/use-payatt";
import { submitPriorityRequest, withdrawPriorityRequest } from "@/lib/payatt.functions";
import { formatDate, formatINR, formatMonth, monthKeyOf, REASON_LABELS, todayIST, type PriorityReason } from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

const REASONS: PriorityReason[] = ["health", "marriage", "house", "debt", "other"];

export function PriorityStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; v: "warning" | "gold" | "success" | "destructive" | "outline" }> = {
    submitted: { label: "Submitted", v: "warning" },
    under_review: { label: "Under review", v: "gold" },
    approved: { label: "Approved", v: "success" },
    declined: { label: "Not approved", v: "destructive" },
    withdrawn: { label: "Withdrawn", v: "outline" },
  };
  const m = map[status] ?? { label: status, v: "outline" as const };
  return <Badge variant={m.v}>{m.label}</Badge>;
}

/** Confidential request for an urgent (priority) turn. Only the member and the Admin can see it. */
export function PriorityRequestCard({ memberToken, requests }: { memberToken: string; requests: MyDashboard["priorityRequests"] }) {
  const qc = useQueryClient();
  const submit = useServerFn(submitPriorityRequest);
  const withdraw = useServerFn(withdrawPriorityRequest);
  const months = useCycleMonthOptions().filter((m) => m >= monthKeyOf(todayIST()));
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PriorityReason>("health");
  const [month, setMonth] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({
        data: {
          member_token: memberToken,
          reason,
          preferred_month: month || null,
          amount_needed: amount ? Number(amount) : null,
          details: details.trim() || undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: ["my-dashboard"] });
      toast.success("Request sent confidentially to the Admin");
      setOpen(false);
      setDetails("");
      setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  }

  async function onWithdraw(id: string) {
    if (!confirm("Withdraw this request?")) return;
    try {
      await withdraw({ data: { member_token: memberToken, id } });
      await qc.invalidateQueries({ queryKey: ["my-dashboard"] });
      toast.success("Request withdrawn");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not withdraw");
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-primary">
            <HeartPulse className="size-4 text-gold" /> Priority Request
          </h2>
          <p className="font-ml text-xs text-muted-foreground">അടിയന്തര ആവശ്യത്തിന് മുൻഗണന അപേക്ഷ</p>
        </div>
        {!open && (
          <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
            Apply
          </Button>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Confidential — only you and the Admin committee see this.
      </p>

      {open && (
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  reason === r ? "border-gold bg-gold-soft text-accent-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {REASON_LABELS[r].en} · <span className="font-ml">{REASON_LABELS[r].ml}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-month">Preferred month</Label>
              <select
                id="pr-month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="">Earliest possible</option>
                {[...months].reverse().map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-amount">Approx. amount (₹)</Label>
              <Input
                id="pr-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-details">Details for the committee</Label>
            <Textarea id="pr-details" rows={3} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="gold" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Send request
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {requests.length > 0 && (
        <ul className="mt-3 divide-y rounded-2xl border">
          {requests.map((r) => (
            <li key={r.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{REASON_LABELS[r.reason as PriorityReason]?.en ?? r.reason}</p>
                <PriorityStatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Sent {formatDate(r.created_at.slice(0, 10))}
                {r.preferred_month ? ` · wants ${formatMonth(r.preferred_month)}` : ""}
                {r.amount_needed ? ` · ${formatINR(r.amount_needed)}` : ""}
              </p>
              {r.status === "approved" && r.assigned_month && (
                <p className="text-sm text-success">Priority slot confirmed for {formatMonth(r.assigned_month)}</p>
              )}
              {r.admin_note && <p className="text-xs italic text-muted-foreground">Admin: {r.admin_note}</p>}
              {(r.status === "submitted" || r.status === "under_review") && (
                <Button size="sm" variant="ghost" onClick={() => onWithdraw(r.id)}>
                  Withdraw
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
