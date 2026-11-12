import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Crown, Loader2, LogOut, Settings } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { MemberSelect } from "@/components/MemberSelect";
import { MemberLoginForm } from "@/components/MemberLoginForm";
import { EventHistory, SelectionBadge } from "@/components/EventCards";
import { PriorityRequestCard } from "@/components/PriorityRequestCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { myDashboardQuery, publicSnapshotQuery, type Member, type MyDashboard } from "@/lib/queries";
import { useEventTotals, useMemberMap, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { buildPassbook, formatDate, formatINR, formatMonth } from "@/lib/payatt-rules";
import { deskLabel } from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/passbook")({
  head: () => ({
    meta: [
      { title: "My Payattu · Sauhrida Panappayattu" },
      {
        name: "description",
        content: "Your Panappayattu dashboard: every recipient and their total, and your own contributions to each.",
      },
      { property: "og:title", content: "My Payattu — വ്യക്തിഗത പാസ്ബുക്ക്" },
      { property: "og:description", content: "Personal passbook with contributions separated by recipient." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicSnapshotQuery),
  component: PassbookPage,
});

function PassbookPage() {
  const { role, member, ready, logoutMember } = useRole();
  const { members, events } = useSnapshot();
  const memberMap = useMemberMap();
  const totals = useEventTotals();
  const qc = useQueryClient();
  const [staffPick, setStaffPick] = useState<string | null>(null);
  const dash = useQuery({ ...myDashboardQuery(member?.token ?? null), enabled: !!member && !member.mustChange });

  useEffect(() => {
    if (dash.error && /sign in again/i.test(dash.error.message)) {
      logoutMember();
      toast.error("Please sign in again");
    }
  }, [dash.error, logoutMember]);

  if (!ready) return null;

  const viewingId = member ? member.memberId : role !== "member" ? staffPick : null;
  const viewing = viewingId ? memberMap.get(viewingId) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle en="My Payattu" ml="വ്യക്തിഗത പാസ്ബുക്ക്">
        {member && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/change-password">
                <Settings /> Profile settings
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                logoutMember();
                qc.removeQueries({ queryKey: ["my-dashboard"] });
                toast.success("Signed out");
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        )}
      </PageTitle>

      {!member && role === "member" && (
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold text-primary">Member sign in</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Use the username and temporary password from the Admin. You'll set your own password the first time.
          </p>
          <MemberLoginForm />
        </div>
      )}

      {!member && role !== "member" && (
        <div className="rounded-2xl border bg-card p-3 shadow-card">
          <p className="mb-2 text-xs text-muted-foreground">Staff view · pick a member to see their published passbook</p>
          <MemberSelect members={members} value={staffPick} onChange={setStaffPick} placeholder="Choose a member" />
        </div>
      )}

      {viewing && (
        <MemberPassbook member={viewing} mine={member ? (dash.data ?? null) : null} loadingMine={!!member && dash.isLoading} />
      )}

      {member && dash.data && <PriorityRequestCard memberToken={member.token} requests={dash.data.priorityRequests} />}

      <section className="rounded-3xl border bg-card p-4 shadow-card">
        <h2 className="font-semibold text-primary">All Payattu recipients</h2>
        <p className="font-ml mb-2 text-xs text-muted-foreground">മാസം · മുൻഗണന / നറുക്കെടുപ്പ് · ലഭിച്ച തുക</p>
        <EventHistory events={events} memberMap={memberMap} totals={totals} highlightMemberId={viewingId} />
      </section>
    </div>
  );
}

function MemberPassbook({
  member,
  mine,
  loadingMine,
}: {
  member: Member;
  mine: MyDashboard | null;
  loadingMine: boolean;
}) {
  const { contributions, events } = useSnapshot();
  const memberMap = useMemberMap();
  const totals = useEventTotals();
  const pb = useMemo(() => buildPassbook(member.id, contributions, events), [member.id, contributions, events]);

  // Own entries (including ones still under review) when signed in; otherwise only published ones.
  type OwnRow = { id: string; event_id: string | null; amount: number; status: string; published: boolean; created_at: string; payment_method: string | null };
  const own: OwnRow[] = mine
    ? mine.contributions
    : contributions.filter((c) => c.member_id === member.id).map((c) => ({ ...c, payment_method: null }));
  const byEvent = new Map<string, typeof own>();
  for (const c of own) {
    if (!c.event_id) continue;
    byEvent.set(c.event_id, [...(byEvent.get(c.event_id) ?? []), c]);
  }
  const sortedEvents = [...events].sort((a, b) => b.month.localeCompare(a.month) || a.event_no - b.event_no);
  const received = events.filter((e) => e.recipient_member_id === member.id);

  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
      <div className="bg-emerald-gradient p-5 text-primary-foreground">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">Slot {member.slot_no}</p>
            <h2 className="mt-1 text-xl font-bold">{member.name}</h2>
            <p className="text-sm text-primary-foreground/75">{member.department}</p>
          </div>
          {member.has_conducted && (
            <span className="flex items-center gap-1 rounded-full bg-gold-gradient px-2.5 py-1 text-xs font-semibold text-gold-foreground">
              <Crown className="size-3.5" /> Received
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Total ml="ആകെ നൽകിയത്" en="Contributed" value={pb.totalPaid} />
          <Total ml="ആകെ ലഭിച്ചത്" en="Received" value={pb.totalReceived} />
          <Total ml="നീക്കിയിരിപ്പ്" en="Net balance" value={pb.net} highlight />
        </div>
        <p className="mt-2 text-[11px] text-primary-foreground/60">Totals count verified entries the Admin has published.</p>
      </div>

      {received.length > 0 && (
        <div className="mx-5 mt-4 rounded-2xl border border-gold/50 bg-gold-soft p-3">
          {received.map((e) => (
            <p key={e.id} className="text-sm">
              <span className="font-semibold">Your Payattu</span> · {formatMonth(e.month)} ({deskLabel(e.event_no).en}) —{" "}
              <span className="font-bold text-primary">{formatINR(totals.get(e.id) ?? 0)}</span> received
            </p>
          ))}
        </div>
      )}

      <div className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-primary">
          {mine ? "My contributions, by recipient" : "Published contributions, by recipient"}
        </h3>
        {loadingMine ? (
          <div className="grid place-items-center p-6">
            <Loader2 className="size-5 animate-spin text-gold" />
          </div>
        ) : byEvent.size === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-2 size-8 text-gold" />
            No contributions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedEvents
              .filter((e) => byEvent.has(e.id))
              .map((e) => {
                const r = e.recipient_member_id ? memberMap.get(e.recipient_member_id) : undefined;
                return (
                  <li key={e.id} className="rounded-2xl border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {formatMonth(e.month)} · {deskLabel(e.event_no).en}
                        </p>
                        <p className="truncate font-semibold">To {r?.name ?? "recipient not decided"}</p>
                      </div>
                      <SelectionBadge type={e.selection_type} />
                    </div>
                    {(byEvent.get(e.id) ?? []).map((c) => (
                      <div key={c.id} className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(c.created_at.slice(0, 10))}
                            {c.payment_method ? ` · ${c.payment_method === "cash" ? "Cash" : "UPI"}` : ""}
                          </p>
                          <StatusBadge status={c.status} published={c.published} />
                        </div>
                        <span className={cn("text-lg font-bold", c.status === "rejected" ? "text-muted-foreground line-through" : "text-primary")}>
                          {formatINR(c.amount)}
                        </span>
                      </div>
                    ))}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, published }: { status: string; published: boolean }) {
  if (status === "pending") return <Badge variant="warning">Pending review</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (published) return <Badge variant="success">Verified · Published</Badge>;
  return <Badge variant="gold">Verified · Under admin review</Badge>;
}

function Total({ ml, en, value, highlight }: { ml: string; en: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl p-2 ring-1", highlight ? "bg-gold-gradient ring-gold" : "bg-ivory/10 ring-gold/30")}>
      <p className={cn("font-ml text-[10px] leading-tight", highlight ? "text-gold-foreground" : "text-gold-soft")}>{ml}</p>
      <p className="mt-1 text-base font-bold">{value < 0 ? `−${formatINR(-value)}` : formatINR(value)}</p>
      <p className={cn("text-[10px]", highlight ? "text-gold-foreground/90" : "text-primary-foreground/60")}>{en}</p>
    </div>
  );
}
