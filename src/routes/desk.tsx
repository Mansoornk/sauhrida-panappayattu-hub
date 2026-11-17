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
import { deskDataQuery, SNAPSHOT_KEY, type DeskContribution, type Member } from "@/lib/queries";
import { useActiveMonth, useCycleMonthOptions, useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { addMember, changePin, publishLedger, removeMember, reviewContribution, updateMember } from "@/lib/payatt.functions";
import {
  buildLoginShareText,
  CYCLE_START_MONTH,
  cycleMonthNumber,
  deskLabel,
  formatINR,
  formatMonth,
  freeSlots,
  nextCycleMonth,
  passwordProblem,
  SELECTION_LABELS,
  suggestUsername,
  toCsvWithBom,
  todayIST,
  type SelectionType,
} from "@/lib/payatt-rules";

export const Route = createFileRoute("/desk")({
  head: () => ({
    meta: [
      { title: "Admin Desk · സൗഹൃദ പണപ്പയറ്റ്" },
      { name: "description", content: "PIN-protected Admin desk to verify contributions, manage cycles and publish the ledger." },
      { property: "og:title", content: "Admin Desk · സൗഹൃദ പണപ്പയറ്റ്" },
      { property: "og:description", content: "Verify, review and publish the Panappayattu ledger." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeskPage,
});

function DeskPage() {
  const { role, token, ready } = useRole();
  const [loginOpen, setLoginOpen] = useState(false);
  const { monthKey } = useActiveMonth();
  const cycleOptions = useCycleMonthOptions();
  const [month, setMonth] = useState(monthKey);
  const [extraMonths, setExtraMonths] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const monthOptions = Array.from(new Set([monthKey, ...cycleOptions, ...extraMonths])).sort().reverse();

  function addMonth(m: string) {
    setExtraMonths((xs) => (xs.includes(m) ? xs : [...xs, m]));
    setMonth(m);
    setAddOpen(false);
  }

  if (!ready) return null;
  if (role !== "admin" || !token) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto size-10 text-gold" />
        <h1 className="mt-3 text-xl font-bold text-primary">Admin Desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Unlock with the Admin PIN.</p>
        <Button variant="gold" size="xl" className="mt-5" onClick={() => setLoginOpen(true)}>
          Unlock desk
        </Button>
        <StaffLoginDialog open={loginOpen} onOpenChange={setLoginOpen} initial="admin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle en="Admin Mode" ml="അഡ്മിൻ ഡെസ്ക്">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => (e.target.value === "__add" ? setAddOpen(true) : setMonth(e.target.value))}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm font-medium"
            aria-label="Month"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                Month {cycleMonthNumber(m)} · {formatMonth(m)}
              </option>
            ))}
            <option value="__add">+ Add New Month / Cycle</option>
          </select>
        </div>
      </PageTitle>
      <AddMonthDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        suggested={nextCycleMonth(monthOptions)}
        existing={monthOptions}
        onAdd={addMonth}
      />

      <Tabs defaultValue="review">
        <TabsList className="mb-3 flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="logins">Logins</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="pins">PIN</TabsTrigger>
        </TabsList>
        <TabsContent value="review">
          <ReviewPanel month={month} />
        </TabsContent>
        <TabsContent value="cycles">
          <CyclesPanel month={month} onAddMonth={() => setAddOpen(true)} />
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
    </div>
  );
}

/** Pick any month and year for a new Payattu cycle (saved once its date is set in Cycles). */
function AddMonthDialog({
  open,
  onOpenChange,
  suggested,
  existing,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suggested: string;
  existing: string[];
  onAdd: (month: string) => void;
}) {
  const [value, setValue] = useState(suggested.slice(0, 7));
  useEffect(() => {
    if (open) setValue(suggested.slice(0, 7));
  }, [open, suggested]);
  const month = `${value}-01`;
  const valid = /^\d{4}-\d{2}$/.test(value) && month >= CYCLE_START_MONTH;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Month / Cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-month">Month and year</Label>
            <Input
              id="new-month"
              type="month"
              min={CYCLE_START_MONTH.slice(0, 7)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {valid && (
            <p className="rounded-xl bg-gold-soft p-3 text-sm text-accent-foreground">
              <span className="font-semibold">Month {cycleMonthNumber(month)}</span> · {formatMonth(month)}
              {existing.includes(month) ? " — already in the list" : ""}
            </p>
          )}
          <Button variant="gold" className="w-full" disabled={!valid} onClick={() => onAdd(month)}>
            <Plus /> {existing.includes(month) ? "Open this month" : "Add month"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Then set its date in the Cycles tab. Time and venue start as 03:45 PM at the Sir Syed College Cafeteria.
          </p>
        </div>
      </DialogContent>
    </Dialog>
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
      if (action !== "verify") await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
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
        qc.invalidateQueries({ queryKey: SNAPSHOT_KEY }),
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

/* ---------------- Members (36-slot roster) ---------------- */

type NewLogin = { name: string; username: string; temp_password: string };

function MembersPanel() {
  const { members } = useSnapshot();
  const { token } = useRole();
  const qc = useQueryClient();
  const remove = useServerFn(removeMember);
  const [editing, setEditing] = useState<Member | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [issued, setIssued] = useState<NewLogin | null>(null);
  const bySlot = new Map(members.map((m) => [m.slot_no, m]));
  const free = freeSlots(members.map((m) => m.slot_no));

  async function onRemove(m: Member) {
    if (!token) return;
    if (!confirm(`Remove ${m.name} from slot ${m.slot_no}? Their past payments stay in the ledgers, and their login stops working.`))
      return;
    try {
      await remove({ data: { token, id: m.id } });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      await qc.invalidateQueries({ queryKey: ["member-accounts"] });
      toast.success(`Slot ${m.slot_no} is now free`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted p-3 text-sm">
        <span>
          <span className="font-semibold">{members.length}</span> of 36 slots filled
          {free.length > 0 && <span className="text-muted-foreground"> · free: {free.join(", ")}</span>}
        </span>
        {free.length > 0 && (
          <Button size="sm" variant="gold" onClick={() => setAdding(free[0]!)}>
            <Plus /> Add member
          </Button>
        )}
      </div>
      <div className="rounded-3xl border bg-card p-3 shadow-card">
        <ul className="divide-y">
          {Array.from({ length: 36 }, (_, i) => i + 1).map((slot) => {
            const m = bySlot.get(slot);
            if (!m)
              return (
                <li key={`free-${slot}`} className="flex items-center gap-3 px-2 py-2">
                  <span className="w-6 text-xs font-bold text-muted-foreground">{slot}</span>
                  <p className="flex-1 text-sm italic text-muted-foreground">Empty slot</p>
                  <Button size="sm" variant="outline" onClick={() => setAdding(slot)}>
                    <Plus /> Add here
                  </Button>
                </li>
              );
            return (
              <li key={m.id} className="flex items-center gap-2 px-2 py-2">
                <span className="w-6 text-xs font-bold text-muted-foreground">{slot}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.department}</p>
                </div>
                {m.has_conducted && <Badge variant="gold">Conducted</Badge>}
                <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`}>
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onRemove(m)} aria-label={`Remove ${m.name}`}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit slot {editing?.slot_no}</DialogTitle>
          </DialogHeader>
          {editing && <MemberForm key={editing.id} member={editing} free={free} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={adding !== null} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
          </DialogHeader>
          {adding !== null && (
            <AddMemberForm
              key={adding}
              slot={adding}
              free={free}
              onDone={(login) => {
                setAdding(null);
                setIssued(login);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login details for {issued?.name}</DialogTitle>
          </DialogHeader>
          {issued && <IssuedLogin login={issued} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssuedLogin({ login }: { login: NewLogin }) {
  const text = buildLoginShareText({
    name: login.name,
    username: login.username,
    tempPassword: login.temp_password,
    link: `${window.location.origin}/passbook`,
  });
  return (
    <div className="space-y-3">
      <pre className="font-ml whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{text}</pre>
      <div className="flex gap-2">
        <Button asChild variant="gold" className="flex-1">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            <Send /> Share on WhatsApp
          </a>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}
        >
          Copy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The member chooses their own password on first sign-in.</p>
    </div>
  );
}

function AddMemberForm({ slot, free, onDone }: { slot: number; free: number[]; onDone: (l: NewLogin) => void }) {
  const { token } = useRole();
  const qc = useQueryClient();
  const add = useServerFn(addMember);
  const [f, setF] = useState({ slot_no: slot, name: "", department: "", phone: "", username: "", temp_password: "" });
  const [userTouched, setUserTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const username = userTouched ? f.username : f.name ? suggestUsername(f.name, f.slot_no) : "";
  const pwProblem = f.temp_password ? passwordProblem(f.temp_password) : null;
  const ok = f.name.trim().length >= 2 && f.department.trim().length >= 2 && username.length >= 3 && !!f.temp_password && !pwProblem;

  async function submit() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await add({ data: { token, ...f, username, phone: f.phone || null } });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
      await qc.invalidateQueries({ queryKey: ["member-accounts"] });
      toast.success(`${res.name} added to slot ${f.slot_no}`);
      onDone({ name: res.name, username: res.username, temp_password: res.temp_password });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="a-slot">Slot</Label>
        <select
          id="a-slot"
          value={f.slot_no}
          onChange={(e) => setF({ ...f, slot_no: Number(e.target.value) })}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {free.map((s) => (
            <option key={s} value={s}>
              Slot {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-name">Name</Label>
        <Input id="a-name" value={f.name} placeholder="Dr. …" onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-dept">Department</Label>
        <Input id="a-dept" value={f.department} placeholder="e.g. Physics" onChange={(e) => setF({ ...f, department: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-phone">Phone</Label>
        <Input id="a-phone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a-user">Username</Label>
          <Input
            id="a-user"
            value={username}
            onChange={(e) => {
              setUserTouched(true);
              setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-pass">Temporary password</Label>
          <Input id="a-pass" value={f.temp_password} onChange={(e) => setF({ ...f, temp_password: e.target.value })} />
          {pwProblem && <p className="text-xs text-destructive">{pwProblem}</p>}
        </div>
      </div>
      <Button className="w-full" variant="gold" onClick={submit} disabled={busy || !ok}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add to slot {f.slot_no}
      </Button>
    </div>
  );
}

function MemberForm({ member, free, onDone }: { member: Member; free: number[]; onDone: () => void }) {
  const { token } = useRole();
  const qc = useQueryClient();
  const update = useServerFn(updateMember);
  const [f, setF] = useState({
    name: member.name,
    department: member.department,
    phone: "",
    slot_no: member.slot_no,
    has_conducted: member.has_conducted,
  });
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!token) return;
    setBusy(true);
    try {
      await update({
        data: {
          token,
          id: member.id,
          name: f.name,
          department: f.department,
          has_conducted: f.has_conducted,
          phone: f.phone || null,
          ...(f.slot_no !== member.slot_no ? { slot_no: f.slot_no } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
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
        <Label htmlFor="m-slot">Slot</Label>
        <select
          id="m-slot"
          value={f.slot_no}
          onChange={(e) => setF({ ...f, slot_no: Number(e.target.value) })}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {[member.slot_no, ...free].sort((a, b) => a - b).map((s) => (
            <option key={s} value={s}>
              Slot {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-name">Name</Label>
        <Input id="m-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-dept">Department</Label>
        <Input id="m-dept" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-phone">New phone number (leave empty to keep the current one)</Label>
        <Input id="m-phone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
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

/* ---------------- Admin PIN ---------------- */

function PinsPanel() {
  const { token, setSession } = useRole();
  const change = useServerFn(changePin);
  const [pin, setPin] = useState("");
  async function submit() {
    if (!token) return;
    try {
      const res = await change({ data: { token, role: "admin", pin } });
      // The PIN change signs out every other Admin session; keep this one signed in.
      setSession({ role: "admin", token: res.token, exp: res.exp });
      toast.success("Admin PIN changed");
      setPin("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change PIN");
    }
  }
  return (
    <div className="max-w-sm space-y-3 rounded-3xl border bg-card p-5 shadow-card">
      <KeyRound className="size-6 text-gold" />
      <h3 className="font-semibold text-primary">Admin PIN</h3>
      <p className="text-xs text-muted-foreground">
        Conductors don't use a PIN any more: each desk's recipient runs their own desk after signing in as a member.
      </p>
      <Input
        inputMode="numeric"
        type="password"
        maxLength={8}
        placeholder="New 4–8 digit PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />
      <Button className="w-full" disabled={pin.length < 4} onClick={submit}>
        Update PIN
      </Button>
    </div>
  );
}
