import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { MemberSelect } from "@/components/MemberSelect";
import { StaffLoginDialog } from "@/components/StaffLoginDialog";
import { CyclesPanel } from "@/components/desk/CyclesPanel";
import { RequestsPanel } from "@/components/desk/RequestsPanel";
import { LoginsPanel } from "@/components/desk/LoginsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deskDataQuery, publicSnapshotQuery, type DeskContribution, type Member } from "@/lib/queries";
import { useActiveMonth, useCycleMonthOptions, useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { changePin, publishLedger, reviewContribution, updateMember } from "@/lib/payatt.functions";
import { deskLabel, formatINR, formatMonth, SELECTION_LABELS, toCsvWithBom, todayIST, type SelectionType } from "@/lib/payatt-rules";

export const Route = createFileRoute("/desk")({
  head: () => ({
    meta: [
      { title: "Conductor & Admin Desk · Sauhrida Panappayattu" },
      { name: "description", content: "PIN-protected desk to verify contributions and publish the monthly ledger." },
      { property: "og:title", content: "Conductor & Admin Desk" },
      { property: "og:description", content: "Verify, review and publish the Panappayattu ledger." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicSnapshotQuery),
  component: DeskPage,
});

function DeskPage() {
  const { role, token, ready } = useRole();
  const [loginOpen, setLoginOpen] = useState(false);
  const { monthKey } = useActiveMonth();
  const cycleOptions = useCycleMonthOptions();
  const [month, setMonth] = useState(monthKey);
  const monthOptions = Array.from(new Set([monthKey, ...cycleOptions])).sort().reverse();

  if (!ready) return null;
  if (role === "member" || !token) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto size-10 text-gold" />
        <h1 className="mt-3 text-xl font-bold text-primary">Conductor &amp; Admin Desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Unlock with your Conductor or Admin PIN.</p>
        <Button variant="gold" size="xl" className="mt-5" onClick={() => setLoginOpen(true)}>
          Unlock desk
        </Button>
        <StaffLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle
        en={role === "admin" ? "Admin Mode" : "Conductor Desk"}
        ml={role === "admin" ? "അഡ്മിൻ ഡെസ്ക്" : "നടത്തിപ്പുകാരുടെ ഡെസ്ക്"}
      >
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm font-medium"
          aria-label="Month"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      </PageTitle>

      {role === "admin" ? (
        <Tabs defaultValue="review">
          <TabsList className="mb-3 flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="logins">Logins</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
            <TabsTrigger value="pins">PINs</TabsTrigger>
          </TabsList>
          <TabsContent value="review">
            <ReviewPanel month={month} />
          </TabsContent>
          <TabsContent value="cycles">
            <CyclesPanel month={month} />
          </TabsContent>
          <TabsContent value="logins">
            <LoginsPanel />
          </TabsContent>
          <TabsContent value="requests">
            <RequestsPanel />
          </TabsContent>
          <TabsContent value="members">
            <MembersPanel />
          </TabsContent>
          <TabsContent value="exports">
            <ExportsPanel month={month} />
          </TabsContent>
          <TabsContent value="pins">
            <PinsPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <ReviewPanel month={month} />
      )}
    </div>
  );
}

/* ---------------- Review ---------------- */

function ReviewPanel({ month }: { month: string }) {
  const { role, token, logout } = useRole();
  const memberMap = useMemberMap();
  const { months, events } = useSnapshot();
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const qc = useQueryClient();
  const desk = useQuery(deskDataQuery(token, month));
  const review = useServerFn(reviewContribution);
  const publish = useServerFn(publishLedger);
  const [publishing, setPublishing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const monthRow = months.find((m) => m.month === month);

  useEffect(() => {
    if (desk.error && /expired/i.test(desk.error.message)) {
      toast.error("Desk session expired. Please log in again.");
      logout();
    }
  }, [desk.error, logout]);

  const rows = desk.data?.contributions ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const drafts = rows.filter((r) => r.status === "verified" && !r.published);
  const published = rows.filter((r) => r.status === "verified" && r.published);
  const sum = (a: DeskContribution[]) => a.reduce((s, r) => s + r.amount, 0);

  async function act(id: string, action: "verify" | "reject" | "delete") {
    if (!token) return;
    if (action === "delete" && !confirm("Delete this entry permanently?")) return;
    setBusyId(id);
    try {
      await review({ data: { token, id, action } });
      await qc.invalidateQueries({ queryKey: ["desk"] });
      if (action !== "verify") await qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function doPublish() {
    if (!token) return;
    if (!monthRow) {
      toast.error("Set up this month in the Cycles tab before publishing.");
      return;
    }
    const includePending =
      pending.length > 0 &&
      confirm(`Also verify the ${pending.length} pending entr${pending.length === 1 ? "y" : "ies"} and publish them now?`);
    setPublishing(true);
    try {
      const res = await publish({ data: { token, month, include_pending: includePending } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["desk"] }),
        qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey }),
      ]);
      toast.success(`Published ${res.count} verified entr${res.count === 1 ? "y" : "ies"} to the site`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Pending check" value={pending.length} sub={formatINR(sum(pending))} tone="warning" />
        <MiniStat label="Verified drafts" value={drafts.length} sub={formatINR(sum(drafts))} tone="gold" />
        <MiniStat label="Published" value={published.length} sub={formatINR(sum(published))} tone="success" />
      </div>

      {role === "admin" && (
        <div className="rounded-3xl bg-emerald-gradient p-5 text-primary-foreground shadow-card">
          <p className="text-sm text-primary-foreground/80">
            {drafts.length > 0
              ? `${drafts.length} verified entr${drafts.length === 1 ? "y is" : "ies are"} hidden from members until you publish.`
              : "No verified drafts waiting. Everything verified is already on the site."}
          </p>
          <Button
            variant="gold"
            size="xl"
            className="mt-3 h-auto w-full flex-col gap-0.5 py-3 whitespace-normal"
            disabled={publishing || drafts.length + pending.length === 0}
            onClick={doPublish}
          >
            <span className="flex items-center gap-2">
              {publishing ? <Loader2 className="animate-spin" /> : <Send />} Verify &amp; Publish Ledger
            </span>
            <span className="font-ml text-xs font-medium opacity-90">പട്ടിക സൈറ്റിൽ പ്രസിദ്ധീകരിക്കുക</span>
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-primary">Entries for {formatMonth(month)}</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/contribute">
            <Plus /> Enter for a member
          </Link>
        </Button>
      </div>

      {desk.isLoading ? (
        <div className="grid place-items-center p-10">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <ClipboardCheck className="mx-auto mb-2 size-8 text-gold" />
          No entries for this month yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const m = memberMap.get(r.member_id);
            return (
              <li key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{m?.name ?? "Unknown member"}</p>
                      <StatusBadge status={r.status} published={r.published} />
                    </div>
                    <p className="text-xs font-medium text-accent-foreground">
                      {(() => {
                        const ev = r.event_id ? eventMap.get(r.event_id) : undefined;
                        if (!ev) return "Desk not set";
                        const to = ev.recipient_member_id ? memberMap.get(ev.recipient_member_id)?.name : null;
                        return `${deskLabel(ev.event_no).en}${to ? ` → ${to}` : ""}`;
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m?.department} · by {r.entered_by}
                      {r.payment_method ? ` · ${r.payment_method === "cash" ? "Cash" : "UPI"}` : ""}
                      {r.utr ? ` · UTR ${r.utr}` : ""}
                    </p>
                    {r.note && <p className="mt-1 text-xs italic text-muted-foreground">“{r.note}”</p>}
                  </div>
                  <p className="text-lg font-bold text-primary">{formatINR(r.amount)}</p>
                </div>
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
                    {r.status !== "rejected" && (!r.published || role === "admin") && (
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "reject")}>
                        <X /> Reject
                      </Button>
                    )}
                    {role === "admin" && (
                      <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => act(r.id, "delete")}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status, published }: { status: string; published: boolean }) {
  if (status === "pending") return <Badge variant="warning">Pending check</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (published) return <Badge variant="success">Published</Badge>;
  return <Badge variant="gold">Draft · Under admin review</Badge>;
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "warning" | "gold" | "success";
}) {
  const toneClass = {
    warning: "bg-warning-soft text-warning",
    gold: "bg-gold-soft text-accent-foreground",
    success: "bg-success-soft text-success",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] font-medium leading-tight">{label}</p>
      <p className="mt-1 text-xs opacity-80">{sub}</p>
    </div>
  );
}

/* ---------------- Members ---------------- */

function MembersPanel() {
  const { members } = useSnapshot();
  const [editing, setEditing] = useState<Member | null>(null);
  return (
    <div className="rounded-3xl border bg-card p-3 shadow-card">
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-2 py-2">
            <span className="w-6 text-xs font-bold text-muted-foreground">{m.slot_no}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name}</p>
              <p className="truncate text-xs text-muted-foreground">{m.department}</p>
            </div>
            {m.has_conducted && <Badge variant="gold">Conducted</Badge>}
            <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`}>
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit slot {editing?.slot_no}</DialogTitle>
          </DialogHeader>
          {editing && <MemberForm key={editing.id} member={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const { token } = useRole();
  const qc = useQueryClient();
  const update = useServerFn(updateMember);
  const [f, setF] = useState({
    name: member.name,
    department: member.department,
    phone: "",
    has_conducted: member.has_conducted,
  });
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!token) return;
    setBusy(true);
    try {
      await update({ data: { token, id: member.id, ...f } });
      await qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey });
      toast.success("Member updated");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="m-name">Name</Label>
        <Input id="m-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-dept">Department</Label>
        <Input id="m-dept" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
      </div>
      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <span className="text-sm">Already conducted a Payatt</span>
        <Switch checked={f.has_conducted} onCheckedChange={(v) => setF({ ...f, has_conducted: v })} />
      </div>
      <Button className="w-full" variant="gold" onClick={submit} disabled={busy}>
        Save
      </Button>
    </div>
  );
}

/* ---------------- Exports (admin only) ---------------- */

function ExportsPanel({ month }: { month: string }) {
  const { token } = useRole();
  const memberMap = useMemberMap();
  const { events } = useSnapshot();
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const desk = useQuery(deskDataQuery(token, month));
  const rows = useMemo(
    () =>
      [...(desk.data?.contributions ?? [])].sort(
        (a, b) => (memberMap.get(a.member_id)?.slot_no ?? 0) - (memberMap.get(b.member_id)?.slot_no ?? 0),
      ),
    [desk.data, memberMap],
  );

  function downloadCsv() {
    const csv = toCsvWithBom(
      [
        "Slot",
        "Name / പേര്",
        "Department",
        "Month",
        "Payattu Desk",
        "Selection",
        "Recipient",
        "Amount (₹)",
        "Method",
        "UTR",
        "Status",
        "Published",
        "Entered by",
        "Date",
      ],
      rows.map((r) => {
        const m = memberMap.get(r.member_id);
        const ev = r.event_id ? eventMap.get(r.event_id) : undefined;
        return [
          m?.slot_no,
          m?.name,
          m?.department,
          formatMonth(r.month),
          ev ? deskLabel(ev.event_no).en : "",
          ev ? (SELECTION_LABELS[ev.selection_type as SelectionType]?.en ?? "") : "",
          ev?.recipient_member_id ? (memberMap.get(ev.recipient_member_id)?.name ?? "") : "",
          r.amount,
          r.payment_method ?? "",
          r.utr ?? "",
          r.status,
          r.published ? "Yes" : "No",
          r.entered_by,
          r.created_at.slice(0, 10),
        ];
      }),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `panappayattu-${month.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel file downloaded");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-3xl border bg-card p-5 shadow-card">
        <Download className="size-6 text-gold" />
        <h3 className="mt-2 font-semibold text-primary">Monthly Excel</h3>
        <p className="text-sm text-muted-foreground">CSV with UTF-8 BOM — Malayalam opens correctly in Excel.</p>
        <Button className="mt-4 w-full" onClick={downloadCsv} disabled={desk.isLoading || rows.length === 0}>
          Download {formatMonth(month)}
        </Button>
      </div>
      <div className="rounded-3xl border bg-card p-5 shadow-card">
        <FileText className="size-6 text-gold" />
        <h3 className="mt-2 font-semibold text-primary">Official A4 statement</h3>
        <p className="text-sm text-muted-foreground">Print or save as PDF with the society emblem.</p>
        <Button asChild variant="gold" className="mt-4 w-full">
          <Link to="/statement" search={{ month }} target="_blank">
            <ExternalLink /> Open statement
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Exports are only visible in Admin Mode. Generated {todayIST()}.</p>
    </div>
  );
}

/* ---------------- PINs ---------------- */

function PinsPanel() {
  const { token } = useRole();
  const change = useServerFn(changePin);
  const [pins, setPins] = useState({ admin: "", conductor: "" });
  async function submit(role: "admin" | "conductor") {
    if (!token) return;
    try {
      await change({ data: { token, role, pin: pins[role] } });
      toast.success(`${role === "admin" ? "Admin" : "Conductor"} PIN changed`);
      setPins({ ...pins, [role]: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change PIN");
    }
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["conductor", "admin"] as const).map((r) => (
        <div key={r} className="space-y-3 rounded-3xl border bg-card p-5 shadow-card">
          <KeyRound className="size-6 text-gold" />
          <h3 className="font-semibold text-primary">{r === "admin" ? "Admin PIN" : "Conductor PIN"}</h3>
          <Input
            inputMode="numeric"
            type="password"
            maxLength={8}
            placeholder="New 4–8 digit PIN"
            value={pins[r]}
            onChange={(e) => setPins({ ...pins, [r]: e.target.value.replace(/\D/g, "") })}
          />
          <Button className="w-full" disabled={pins[r].length < 4} onClick={() => submit(r)}>
            Update PIN
          </Button>
        </div>
      ))}
    </div>
  );
}
