import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Lock, Printer } from "lucide-react";
import logo from "@/assets/sauhrida-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { deskDataQuery } from "@/lib/queries";
import { useMemberMap, useMonthEvents, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import {
  deskLabel,
  describeMonthMode,
  formatDate,
  formatINR,
  formatMonth,
  monthKeyOf,
  REASON_LABELS,
  SELECTION_LABELS,
  todayIST,
  type PriorityReason,
  type SelectionType,
} from "@/lib/payatt-rules";

export const Route = createFileRoute("/statement")({
  validateSearch: z.object({ month: z.string().regex(/^\d{4}-\d{2}-01$/).optional() }),
  head: () => ({
    meta: [
      { title: "Official Statement · Sauhrida Panappayattu" },
      { name: "description", content: "Admin-only printable A4 statement of the monthly Panappayattu ledger." },
      { property: "og:title", content: "Official Panappayattu Statement" },
      { property: "og:description", content: "Printable A4 monthly statement, one column per recipient." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StatementPage,
});

function StatementPage() {
  const { month: m } = Route.useSearch();
  const month = m ?? monthKeyOf(todayIST());
  const { role, token, ready } = useRole();
  const { members, months } = useSnapshot();
  const memberMap = useMemberMap();
  const events = useMonthEvents(month);
  const desk = useQuery({ ...deskDataQuery(token, month), enabled: role === "admin" && !!token });
  const monthRow = months.find((x) => x.month === month);

  // amount per (event, member), verified entries only
  const cell = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of desk.data?.contributions ?? []) {
      if (c.status !== "verified" || !c.event_id) continue;
      const k = `${c.event_id}:${c.member_id}`;
      map.set(k, (map.get(k) ?? 0) + c.amount);
    }
    return map;
  }, [desk.data]);

  if (!ready) return null;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto size-10 text-gold" />
        <p className="mt-3 text-sm text-muted-foreground">The official statement is available in Admin Mode only.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/desk">Go to desk</Link>
        </Button>
      </div>
    );
  }

  const eventTotalOf = (id: string) => members.reduce((s, mm) => s + (cell.get(`${id}:${mm.id}`) ?? 0), 0);

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button variant="gold" onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>
      <article className="print-sheet mx-auto max-w-[210mm] overflow-x-auto rounded-xl border bg-card p-8 text-sm shadow-card">
        <header className="flex items-center gap-4 border-b-2 border-gold pb-4">
          <img src={logo.url} alt="Society emblem" className="size-20 rounded-full" />
          <div className="flex-1">
            <p className="font-ml text-xl font-bold text-primary">സൗഹൃദ പണപ്പയറ്റ്</p>
            <p className="font-semibold">Sauhrida Panappayattu · Sir Syed College, Taliparamba</p>
            <p className="text-xs text-muted-foreground">36 Hearts, Zero Interest, Infinite Brotherhood</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold uppercase tracking-wider text-accent-foreground">Official Statement</p>
            <p className="text-base font-bold text-primary">{formatMonth(month)}</p>
            <p className="text-muted-foreground">Issued {formatDate(todayIST())}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <p>
            <span className="text-muted-foreground">Payattu date:</span>{" "}
            {monthRow ? formatDate(monthRow.payatt_date) : "—"}
            {monthRow?.event_time ? `, ${monthRow.event_time}` : ""}
            {monthRow?.venue ? ` · ${monthRow.venue}` : ""}
          </p>
          <p>
            <span className="text-muted-foreground">Ledger status:</span>{" "}
            {monthRow?.ledger_published ? "Published" : "Under admin review"}
          </p>
          <p>
            <span className="text-muted-foreground">Allocation:</span> {describeMonthMode(events)}
          </p>
          {events.map((e) => {
            const r = e.recipient_member_id ? memberMap.get(e.recipient_member_id) : null;
            const type = SELECTION_LABELS[e.selection_type as SelectionType];
            return (
              <p key={e.id}>
                <span className="text-muted-foreground">{deskLabel(e.event_no).en} ({type?.en}):</span> {r?.name ?? "—"}
                {e.priority_reason ? ` (${REASON_LABELS[e.priority_reason as PriorityReason].en})` : ""}
              </p>
            );
          })}
        </section>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-emerald-gradient text-primary-foreground">
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Name</th>
              <th className="px-2 py-1.5 text-left">Department</th>
              {events.map((e) => (
                <th key={e.id} className="px-2 py-1.5 text-right">
                  {deskLabel(e.event_no).en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((mm, i) => (
              <tr key={mm.id} className={i % 2 ? "bg-muted" : ""}>
                <td className="px-2 py-1">{mm.slot_no}</td>
                <td className="px-2 py-1">{mm.name}</td>
                <td className="px-2 py-1">{mm.department}</td>
                {events.map((e) => {
                  const amt = cell.get(`${e.id}:${mm.id}`) ?? 0;
                  return (
                    <td key={e.id} className="px-2 py-1 text-right font-medium">
                      {e.recipient_member_id === mm.id ? "Recipient" : amt ? formatINR(amt) : "Not paid"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gold font-bold">
              <td colSpan={3} className="px-2 py-2 text-right">
                Total received by each recipient · <span className="font-ml">ആകെ</span>
              </td>
              {events.map((e) => (
                <td key={e.id} className="px-2 py-2 text-right text-primary">
                  {formatINR(eventTotalOf(e.id))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        {events.length === 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">No Payattu is set up for this month.</p>
        )}

        <footer className="mt-12 grid grid-cols-3 gap-6 text-center text-xs">
          {["Payattu Desk 1", "Payattu Desk 2", "Admin"].map((s, i) => (
            <div key={i}>
              <div className="mb-1 border-t border-foreground/40" />
              {s}
            </div>
          ))}
        </footer>
      </article>
    </div>
  );
}
