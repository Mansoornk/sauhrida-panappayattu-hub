import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { PriorityStatusBadge } from "@/components/PriorityRequestCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listPriorityRequests, reviewPriorityRequest } from "@/lib/payatt.functions";
import { useCycleMonthOptions, useMemberMap } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { formatDate, formatINR, formatMonth, REASON_LABELS, type PriorityReason } from "@/lib/payatt-rules";

type Status = "submitted" | "under_review" | "approved" | "declined";
const ORDER: Record<string, number> = { submitted: 0, under_review: 1, approved: 2, declined: 3, withdrawn: 4 };

/** Committee review of confidential priority requests: evaluate, sort and confirm slots. */
export function RequestsPanel() {
  const { token } = useRole();
  const list = useServerFn(listPriorityRequests);
  const q = useQuery({
    queryKey: ["priority-requests", token],
    queryFn: () => list({ data: { token: token! } }),
    enabled: !!token,
  });
  const rows = [...(q.data ?? [])].sort(
    (a, b) =>
      (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) ||
      (a.preferred_month ?? "9999").localeCompare(b.preferred_month ?? "9999") ||
      a.created_at.localeCompare(b.created_at),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-2xl border border-gold/40 bg-gold-soft p-3 text-sm text-accent-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Confidential. Members never see each other's requests. Approving a request books a priority slot — then add
        that member as a Priority desk in the Cycles tab for that month.
      </div>
      {q.isLoading ? (
        <div className="grid place-items-center p-10">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <HeartPulse className="mx-auto mb-2 size-8 text-gold" />
          No priority requests yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <RequestRow key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({ row }: { row: Awaited<ReturnType<typeof listPriorityRequests>>[number] }) {
  const { token } = useRole();
  const memberMap = useMemberMap();
  const months = useCycleMonthOptions();
  const qc = useQueryClient();
  const review = useServerFn(reviewPriorityRequest);
  const [assigned, setAssigned] = useState(row.assigned_month ?? row.preferred_month ?? "");
  const [note, setNote] = useState(row.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const m = memberMap.get(row.member_id);
  const closed = row.status === "withdrawn";

  async function act(status: Status) {
    if (!token) return;
    setBusy(true);
    try {
      await review({
        data: { token, id: row.id, status, assigned_month: assigned || null, admin_note: note.trim() || null },
      });
      await qc.invalidateQueries({ queryKey: ["priority-requests"] });
      toast.success("Request updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 rounded-2xl border bg-card p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{m?.name ?? "Member"}</p>
          <p className="text-xs text-muted-foreground">
            {REASON_LABELS[row.reason as PriorityReason]?.en ?? row.reason} · sent {formatDate(row.created_at.slice(0, 10))}
            {row.preferred_month ? ` · wants ${formatMonth(row.preferred_month)}` : ""}
            {row.amount_needed ? ` · ${formatINR(row.amount_needed)}` : ""}
          </p>
        </div>
        <PriorityStatusBadge status={row.status} />
      </div>
      {row.details && <p className="whitespace-pre-wrap rounded-xl bg-muted p-2 text-sm">{row.details}</p>}
      {!closed && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`am-${row.id}`} className="text-xs font-medium">
              Priority slot month
            </label>
            <select
              id={`am-${row.id}`}
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">—</option>
              {[...months].reverse().map((mm) => (
                <option key={mm} value={mm}>
                  {formatMonth(mm)}
                </option>
              ))}
            </select>
          </div>
          <Textarea rows={1} placeholder="Note to the member (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act("under_review")}>
              Under review
            </Button>
            <Button size="sm" variant="gold" disabled={busy || !assigned} onClick={() => act("approved")}>
              Approve slot
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("declined")}>
              Decline
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
