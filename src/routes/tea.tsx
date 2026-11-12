import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, Coffee, Copy, Loader2, MapPin, MessageCircle, Save, Send, Users } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { MemberSelect } from "@/components/MemberSelect";
import { SelectionBadge } from "@/components/EventCards";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { publicSnapshotQuery, type PayattEvent } from "@/lib/queries";
import { useActiveMonth, useMemberMap, useMonthEvents, useSnapshot } from "@/lib/use-payatt";
import { useRole } from "@/lib/role-context";
import { saveHostDesk } from "@/lib/payatt.functions";
import {
  APPEAL_TEMPLATES,
  buildWhatsAppInvite,
  DEFAULT_TIME,
  DEFAULT_VENUE,
  deskLabel,
  formatDate,
  formatMonth,
  TEA_MENU,
} from "@/lib/payatt-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tea")({
  head: () => ({
    meta: [
      { title: "Tea Party & Host Desk · Sauhrida Panappayattu" },
      {
        name: "description",
        content: "Joint Host Desk for the month's Payattu recipients: Malayalam appeal, tea menu and WhatsApp invitations.",
      },
      { property: "og:title", content: "Malabar Tea Party — ചായസൽക്കാരം" },
      { property: "og:description", content: "Host Desk with appeal notes and one-tap WhatsApp invitations." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicSnapshotQuery),
  component: TeaPage,
});

function TeaPage() {
  const { members } = useSnapshot();
  const { month, monthKey } = useActiveMonth();
  const events = useMonthEvents(monthKey);
  const memberMap = useMemberMap();
  const { role, member, token } = useRole();
  const isAdmin = role === "admin";
  const hostEvent = member ? events.find((e) => e.recipient_member_id === member.memberId) : undefined;
  const canHost = isAdmin || !!hostEvent;
  const [personal, setPersonal] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const hosts = events
    .filter((e) => e.recipient_member_id)
    .map((e) => ({
      desk: e.event_no,
      name: memberMap.get(e.recipient_member_id!)?.name ?? "",
      type: e.selection_type,
      appeal: e.appeal_note,
    }));
  const invite = (to?: string | null) =>
    buildWhatsAppInvite({
      monthLabel: formatMonth(monthKey),
      dateLabel: month ? formatDate(month.payatt_date) : null,
      time: month?.event_time ?? null,
      venue: month?.venue ?? null,
      hosts,
      link: origin,
      personalTo: to ?? null,
    });
  const groupText = invite();
  const personalName = personal ? memberMap.get(personal)?.name : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle en="Tea Party & Host Desk" ml="ചായസൽക്കാരം · ആതിഥേയ ഡെസ്ക്" />

      <section className="rounded-3xl bg-emerald-gradient p-5 text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">{formatMonth(monthKey)} gathering</p>
        {month ? (
          <div className="mt-2 space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 text-gold-soft" /> {formatDate(month.payatt_date)}
            </p>
            <p className="font-ml flex items-center gap-2">
              <Clock className="size-4 text-gold-soft" /> {month.event_time || DEFAULT_TIME}
            </p>
            <p className="font-ml flex items-center gap-2">
              <MapPin className="size-4 text-gold-soft" /> {month.venue || DEFAULT_VENUE}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-primary-foreground/80">The Admin hasn't scheduled this month yet.</p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl bg-ivory/10 p-3 ring-1 ring-gold/30">
              <p className="font-ml text-xs text-gold-soft">{deskLabel(e.event_no).ml}</p>
              <p className="font-semibold">
                {e.recipient_member_id ? memberMap.get(e.recipient_member_id)?.name : "To be decided"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {!canHost && (
        <p className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          <Users className="mb-1 size-4 text-gold" />
          This month's Payattu Desk hosts sign in to write their appeal and choose the tea menu. Everyone can share the
          invitation below.
        </p>
      )}

      {canHost &&
        events
          .filter((e) => isAdmin || e.id === hostEvent?.id)
          .map((e) => <AppealEditor key={e.id} event={e} memberToken={member?.token} staffToken={isAdmin ? token : null} />)}

      {canHost && month && (
        <MenuBuilder
          month={monthKey}
          initial={month.tea_menu}
          memberToken={member?.token}
          staffToken={isAdmin ? token : null}
        />
      )}

      <section className="rounded-3xl border bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-semibold text-primary">
          <MessageCircle className="size-4" /> WhatsApp invitation
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Date, time, venue, co-hosts, appeal and the app link. The tea menu stays on the web page only.
        </p>
        <pre className="font-ml whitespace-pre-wrap rounded-xl border bg-background p-4 text-sm leading-relaxed">
          {groupText}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="gold">
            <a href={`https://wa.me/?text=${encodeURIComponent(groupText)}`} target="_blank" rel="noreferrer">
              <Users /> Share to WhatsApp Group
            </a>
          </Button>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(groupText).then(() => toast.success("Copied"))}>
            <Copy /> Copy text
          </Button>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl bg-muted p-3">
          <p className="text-sm font-semibold">Personal invite</p>
          <MemberSelect members={members} value={personal} onChange={setPersonal} placeholder="Choose a colleague" />
          <Button asChild variant="default" className="w-full" disabled={!personalName}>
            <a
              href={personalName ? `https://wa.me/?text=${encodeURIComponent(invite(personalName))}` : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!personalName}
              className={cn(!personalName && "pointer-events-none opacity-50")}
            >
              <Send /> Share Personal Invite{personalName ? ` to ${personalName}` : ""}
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}

function AppealEditor({
  event,
  memberToken,
  staffToken,
}: {
  event: PayattEvent;
  memberToken: string | undefined;
  staffToken: string | null;
}) {
  const memberMap = useMemberMap();
  const qc = useQueryClient();
  const save = useServerFn(saveHostDesk);
  const [text, setText] = useState(event.appeal_note ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(event.appeal_note ?? ""), [event.appeal_note]);
  const name = event.recipient_member_id ? memberMap.get(event.recipient_member_id)?.name : null;

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          token: staffToken ?? undefined,
          member_token: staffToken ? undefined : memberToken,
          month: event.month,
          event_id: event.id,
          appeal_note: text.trim() || null,
        },
      });
      await qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey });
      toast.success("Appeal saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-primary">
            Appeal note · <span className="font-ml text-sm">{deskLabel(event.event_no).ml}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{name ?? "Recipient not decided"} · optional, in Malayalam</p>
        </div>
        <SelectionBadge type={event.selection_type} />
      </div>
      <div className="flex flex-wrap gap-2">
        {APPEAL_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setText(t.text)}
            className="rounded-full border border-gold/50 bg-gold-soft px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:brightness-95"
          >
            {t.label}
          </button>
        ))}
      </div>
      <Textarea
        rows={4}
        maxLength={800}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-ml"
        placeholder="നിങ്ങളുടെ അഭ്യർത്ഥന ഇവിടെ എഴുതുക…"
        aria-label="Appeal note"
      />
      <Button variant="gold" onClick={submit} disabled={busy || text.trim() === (event.appeal_note ?? "")}>
        {busy ? <Loader2 className="animate-spin" /> : <Save />} Save appeal
      </Button>
    </section>
  );
}

function MenuBuilder({
  month,
  initial,
  memberToken,
  staffToken,
}: {
  month: string;
  initial: string[];
  memberToken: string | undefined;
  staffToken: string | null;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveHostDesk);
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(initial), [initial]);
  const dirty = [...picked].sort().join() !== [...initial].sort().join();

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          token: staffToken ?? undefined,
          member_token: staffToken ? undefined : memberToken,
          month,
          tea_menu: picked,
        },
      });
      await qc.invalidateQueries({ queryKey: publicSnapshotQuery.queryKey });
      toast.success(picked.length ? "Menu saved — shown on the home page" : "Menu cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-5 shadow-card">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-primary">
          <Coffee className="size-4 text-gold" /> Tea party menu <span className="text-xs font-normal">(optional)</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Shown on the home page only — never in the WhatsApp text. Leave empty to hide it.
        </p>
      </div>
      {(["savory", "drink"] as const).map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
            {g === "savory" ? "Hot savories" : "Beverages"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEA_MENU.filter((t) => t.group === g).map((t) => {
              const on = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    on ? "border-gold bg-gold-soft font-semibold text-accent-foreground" : "bg-background hover:bg-muted",
                  )}
                >
                  {on && <Check className="size-3" />}
                  {t.en} · <span className="font-ml">{t.ml}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Button variant="gold" onClick={submit} disabled={busy || !dirty}>
        {busy ? <Loader2 className="animate-spin" /> : <Save />} Save menu
      </Button>
    </section>
  );
}
