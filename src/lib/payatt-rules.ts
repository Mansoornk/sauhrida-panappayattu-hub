// Pure business rules for Sauhrida Panappayattu. No I/O — safe for client, server and tests.

export const MIN_CONTRIBUTION = 2500;
export const TOTAL_MEMBERS = 36;
export const IST_TIMEZONE = "Asia/Kolkata";
/** Month 1 of the Payattu timeline. */
export const CYCLE_START_MONTH = "2026-10-01";
export const MIN_PASSWORD_LENGTH = 8;

export type Role = "member" | "conductor" | "admin";
export type ContributionStatus = "pending" | "verified" | "rejected";
export type PriorityReason = "health" | "marriage" | "house" | "debt" | "other";
export type SelectionType = "priority" | "lottery";

export const REASON_LABELS: Record<PriorityReason, { en: string; ml: string }> = {
  health: { en: "Medical", ml: "ചികിത്സ" },
  marriage: { en: "Wedding", ml: "വിവാഹം" },
  house: { en: "House construction", ml: "ഭവന നിർമ്മാണം" },
  debt: { en: "Debt relief", ml: "കടബാധ്യത" },
  other: { en: "Other urgent need", ml: "മറ്റ് അടിയന്തര ആവശ്യം" },
};

export const DEFAULT_VENUE = "കോളേജ് കഫറ്റീരിയ (College Cafeteria)";
export const DEFAULT_TIME = "3:30 PM (ക്ലാസ്സ് സമയത്തിന് ശേഷം / After Class Hours)";

/** "Payattu Desk 1" / "പയറ്റ് ഡെസ്ക് 1" — each desk is one recipient's separate ledger. */
export function deskLabel(no: number): { en: string; ml: string } {
  return { en: `Payattu Desk ${no}`, ml: `പയറ്റ് ഡെസ്ക് ${no}` };
}

export const TEA_MENU: { group: "savory" | "drink"; id: string; en: string; ml: string }[] = [
  { group: "savory", id: "porotta-beef", en: "Porotta & Beef Roast", ml: "പൊറോട്ട & ബീഫ് റോസ്റ്റ്" },
  { group: "savory", id: "chicken-roll", en: "Chicken Roll", ml: "ചിക്കൻ റോൾ" },
  { group: "savory", id: "porotta-roll", en: "Porotta Roll", ml: "പൊറോട്ട റോൾ" },
  { group: "savory", id: "appam-stew", en: "Appam Mix / Stew", ml: "അപ്പം / സ്റ്റ്യൂ" },
  { group: "savory", id: "meat-puffs", en: "Meat Puffs", ml: "മീറ്റ് പഫ്സ്" },
  { group: "savory", id: "chicken-cutlet", en: "Chicken Cutlet", ml: "ചിക്കൻ കട്ലറ്റ്" },
  { group: "savory", id: "pazham-pori", en: "Pazham Pori", ml: "പഴംപൊരി" },
  { group: "savory", id: "samosa", en: "Samosa", ml: "സമൂസ" },
  { group: "savory", id: "unnakaya", en: "Unnakaya", ml: "ഉന്നക്കായ" },
  { group: "drink", id: "sulaimani", en: "Special Kannur Sulaimani", ml: "കണ്ണൂർ സുലൈമാനി" },
  { group: "drink", id: "dum-tea", en: "Dum Tea", ml: "ദം ചായ" },
  { group: "drink", id: "filter-coffee", en: "Filter Coffee", ml: "ഫിൽട്ടർ കോഫി" },
  { group: "drink", id: "mint-lime", en: "Mint Lime", ml: "മിന്റ് ലൈം" },
];
export const TEA_MENU_IDS = new Set(TEA_MENU.map((t) => t.id));

export const APPEAL_TEMPLATES: { id: "house" | "marriage" | "health"; label: string; text: string }[] = [
  {
    id: "house",
    label: "House Construction",
    text: "ഭവന നിർമ്മാണ ആവശ്യങ്ങൾക്കായി വലിയൊരു തുക അടിയന്തരമായി ആവശ്യമുണ്ട്, അതിനാൽ നിങ്ങളുടെ വലിയൊരു സഹായവും സംഭാവനയും പ്രതീക്ഷിക്കുന്നു.",
  },
  {
    id: "marriage",
    label: "Marriage",
    text: "വീട്ടിലെ വിവാഹ ആവശ്യങ്ങൾക്കായി ഒരു വലിയ തുക ആവശ്യമുണ്ട്. എല്ലാവരുടെയും സ്നേഹപൂർവ്വമായ സഹകരണവും ഉദാരമായ സംഭാവനയും പ്രതീക്ഷിക്കുന്നു.",
  },
  {
    id: "health",
    label: "Medical Emergency",
    text: "അടിയന്തര ചികിത്സാ ആവശ്യങ്ങൾക്കായി തുക അത്യാവശ്യമാണ്. ഈ പ്രയാസ ഘട്ടത്തിൽ നിങ്ങളുടെ കൈത്താങ്ങും സഹായവും പ്രതീക്ഷിക്കുന്നു.",
  },
];

export const SELECTION_LABELS: Record<SelectionType, { en: string; ml: string }> = {
  priority: { en: "Priority", ml: "മുൻഗണന" },
  lottery: { en: "Lottery", ml: "നറുക്കെടുപ്പ്" },
};

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && Number.isInteger(amount) && amount >= MIN_CONTRIBUTION;
}

/** UTR is optional: empty is valid, otherwise exactly 12 digits. */
export function isValidUtr(utr: string | null | undefined): boolean {
  if (utr == null || utr.trim() === "") return true;
  return /^[0-9]{12}$/.test(utr.trim());
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** First day of a month (YYYY-MM-01) for a YYYY-MM-DD date. */
export function monthKeyOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(monthKey: string, n: number): string {
  const d = new Date(`${monthKey.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------------- Timeline ---------------- */

/** 1 for October (start), 2 for November, … ; 0 or less means before the scheme started. */
export function cycleMonthNumber(monthKey: string): number {
  const [y0, m0] = CYCLE_START_MONTH.split("-").map(Number) as [number, number];
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  return (y - y0) * 12 + (m - m0) + 1;
}

/** October (Month 1) has a single Payattu; from November onwards up to two. */
export function maxEventsForMonth(monthKey: string): number {
  const n = cycleMonthNumber(monthKey);
  if (n < 1) return 0;
  return n === 1 ? 1 : 2;
}

/** All months from the start of the scheme up to (and including) `untilMonth`, newest first. */
export function cycleMonths(untilMonth: string): string[] {
  const out: string[] = [];
  let m = CYCLE_START_MONTH;
  while (m <= untilMonth) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out.reverse();
}

type EventLike = {
  id?: string;
  month: string;
  event_no: number;
  selection_type: SelectionType | string;
  recipient_member_id: string | null;
};

/** Returns an error message if a month's set of Payattu events is not allowed, otherwise null. */
export function validateMonthEvents(monthKey: string, events: EventLike[]): string | null {
  const max = maxEventsForMonth(monthKey);
  if (max === 0) return "The Payattu timeline starts in October. Earlier months can't be recorded.";
  if (events.length > max)
    return max === 1
      ? "October (Month 1) has a single Payattu only."
      : "A month can have at most two Payattu events.";
  for (const e of events) {
    if (e.selection_type !== "priority" && e.selection_type !== "lottery")
      return "Each Payattu must be marked Priority or Lottery.";
    if (e.event_no < 1 || e.event_no > max) return "Invalid Payattu number for this month.";
  }
  const nos = events.map((e) => e.event_no);
  if (new Set(nos).size !== nos.length) return "Two Payattu events can't share the same number.";
  const recipients = events.map((e) => e.recipient_member_id).filter(Boolean);
  if (new Set(recipients).size !== recipients.length)
    return "The same member can't be the recipient of both Payattu events in a month.";
  return null;
}

/** Human description of the month's allocation, e.g. "1 Priority + 1 Lottery". */
export function describeMonthMode(events: Pick<EventLike, "selection_type">[]): string {
  if (events.length === 0) return "No Payattu set up";
  const p = events.filter((e) => e.selection_type === "priority").length;
  const l = events.filter((e) => e.selection_type === "lottery").length;
  if (events.length === 1) return p ? "Single Payattu · Priority" : "Single Payattu · Lottery";
  return `${p} Priority + ${l} Lottery`;
}

/* ---------------- Lottery wheel ---------------- */

/** The wheel window: 3 days before the Payattu date until 2 days before. */
export function wheelWindow(payattDate: string): { opens: string; closes: string } {
  return { opens: addDays(payattDate, -3), closes: addDays(payattDate, -2) };
}

/** First day the wheel can be spun. */
export function wheelDayFor(payattDate: string): string {
  return wheelWindow(payattDate).opens;
}

export function isWheelDay(today: string, payattDate: string): boolean {
  const w = wheelWindow(payattDate);
  return today >= w.opens && today <= w.closes;
}

/** Spinning needs Admin monitoring AND (2–3 days before the Payattu OR the admin test override). */
export function canSpinWheel(opts: {
  role: Role;
  today: string;
  payattDate: string | null | undefined;
  override: boolean;
}): boolean {
  if (opts.role !== "admin") return false;
  if (opts.override) return true;
  if (!opts.payattDate) return false;
  return isWheelDay(opts.today, opts.payattDate);
}

/** Lottery events that still need a winner. Priority events never use the wheel. */
export function eventsNeedingDraw<E extends EventLike>(events: E[]): E[] {
  return events
    .filter((e) => e.selection_type === "lottery" && !e.recipient_member_id)
    .sort((a, b) => a.event_no - b.event_no);
}

type MemberLike = { id: string; has_conducted: boolean };
type ContributionLike = {
  member_id: string;
  month: string;
  amount: number;
  status: ContributionStatus | string;
  published?: boolean;
  event_id?: string | null;
};

/** Lottery candidates: members with at least one verified payment who have not conducted a Payatt. */
export function wheelCandidates<M extends MemberLike>(
  members: M[],
  contributions: ContributionLike[],
  excludeIds: (string | null | undefined)[] = [],
): M[] {
  const verified = new Set(
    contributions.filter((c) => c.status === "verified").map((c) => c.member_id),
  );
  const excluded = new Set(excludeIds.filter(Boolean) as string[]);
  return members.filter((m) => !m.has_conducted && verified.has(m.id) && !excluded.has(m.id));
}

/* ---------------- Ledgers ---------------- */

/** Only verified AND admin-published entries count publicly. */
export function countsPublicly(c: { status: string; published: boolean }): boolean {
  return c.status === "verified" && c.published === true;
}

/**
 * Total a recipient collected: the sum of member contributions made to THAT event only.
 * No pooling and no 50/50 split between the month's recipients.
 */
export function eventTotal(
  eventId: string,
  contributions: (ContributionLike & { published: boolean })[],
  opts: { publicOnly?: boolean } = {},
): number {
  const publicOnly = opts.publicOnly ?? true;
  return contributions
    .filter((c) => c.event_id === eventId)
    .filter((c) => (publicOnly ? countsPublicly(c) : c.status === "verified"))
    .reduce((s, c) => s + c.amount, 0);
}

export type PassbookRow = {
  event_id: string;
  month: string;
  paid: number;
  received: number;
};

export function buildPassbook(
  memberId: string,
  contributions: (ContributionLike & { published: boolean })[],
  events: { id: string; month: string; event_no: number; recipient_member_id: string | null }[],
): { rows: PassbookRow[]; totalPaid: number; totalReceived: number; net: number } {
  const rows: PassbookRow[] = [];
  for (const e of [...events].sort((a, b) => a.month.localeCompare(b.month) || a.event_no - b.event_no)) {
    const paid = contributions
      .filter((c) => c.event_id === e.id && c.member_id === memberId && countsPublicly(c))
      .reduce((s, c) => s + c.amount, 0);
    const received = e.recipient_member_id === memberId ? eventTotal(e.id, contributions) : 0;
    if (paid || received) rows.push({ event_id: e.id, month: e.month, paid, received });
  }
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  return { rows, totalPaid, totalReceived, net: totalPaid - totalReceived };
}

/* ---------------- Member logins ---------------- */

/** "Dr. Ismail Olayikkara", slot 1 → "ismail01". */
export function suggestUsername(name: string, slot: number): string {
  const cleaned = name
    .replace(/^\s*(dr|mr|mrs|ms|prof)\.?\s*/i, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .trim();
  const first = cleaned.split(/\s+/).find((w) => w.length >= 2) ?? "member";
  return `${first.slice(0, 12)}${String(slot).padStart(2, "0")}`;
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9._]{3,30}$/.test(u);
}

/** New passwords: at least 8 characters with a letter and a number. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use both letters and numbers";
  return null;
}

/* ---------------- WhatsApp invitation ---------------- */

/**
 * Invitation text for the month's Payattu. Deliberately never includes the tea menu:
 * the menu is shown on the web page only.
 */
export function buildWhatsAppInvite(opts: {
  monthLabel: string;
  dateLabel: string | null;
  time: string | null;
  venue: string | null;
  hosts: { desk: number; name: string; type: SelectionType | string; appeal?: string | null }[];
  link: string;
  personalTo?: string | null;
}): string {
  const lines: (string | null)[] = [
    "🌿 *സൗഹൃദ പണപ്പയറ്റ് — Sauhrida Panappayattu* 🌿",
    "_36 Hearts, Zero Interest, Infinite Brotherhood_",
    "",
    opts.personalTo ? `പ്രിയ ${opts.personalTo},` : null,
    `📅 *${opts.monthLabel} Payattu*${opts.dateLabel ? ` — ${opts.dateLabel}` : ""}`,
    `🕞 ${opts.time || DEFAULT_TIME}`,
    `📍 ${opts.venue || DEFAULT_VENUE}`,
    "",
    opts.hosts.length ? "🤝 *ആതിഥേയർ / Co-hosts*" : null,
    ...opts.hosts.map((h) => {
      const t = SELECTION_LABELS[h.type as SelectionType] ?? SELECTION_LABELS.priority;
      return `• ${deskLabel(h.desk).ml} (${t.ml}): *${h.name}*`;
    }),
    ...opts.hosts
      .filter((h) => h.appeal && h.appeal.trim())
      .flatMap((h) => ["", `💬 _${h.name}:_ ${h.appeal!.trim()}`]),
    "",
    opts.hosts.length > 1 ? "ഓരോ ഡെസ്കിനും വെവ്വേറെ അടയ്ക്കുക. മിനിമം ₹2,500 / ഡെസ്ക്." : "മിനിമം അടവ് ₹2,500.",
    "എല്ലാവരെയും ചായസൽക്കാരത്തിലേക്ക് സ്നേഹപൂർവ്വം ക്ഷണിക്കുന്നു 🙏",
    "",
    `🔗 ${opts.link}`,
  ];
  return lines
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/* ---------------- Formatting ---------------- */

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with UTF-8 BOM so Excel shows Malayalam correctly. */
export function toCsvWithBom(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

export function formatINR(n: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(n);
}

export function formatMonth(monthKey: string): string {
  const d = new Date(`${monthKey.slice(0, 7)}-01T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ---------------- Live lucky wheel ---------------- */

/** Members get the pop-up + chime this long before the scheduled draw. */
export const LIVE_ALERT_MS = 60_000;
/** How long one synchronized spin animates on every screen. */
export const LIVE_SPIN_MS = 7_000;
const IST_OFFSET = "+05:30";

/** Admin form values ("2026-12-23", "15:30", India time) → ISO instant. */
export function drawAtFromIST(date: string, time: string): string {
  return new Date(`${date}T${time}:00${IST_OFFSET}`).toISOString();
}

/** ISO instant → India-time form values. */
export function drawAtToIST(iso: string): { date: string; time: string } {
  const s = new Date(new Date(iso).getTime() + 330 * 60_000).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

export function formatDrawAt(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "2d 04:05:09" / "04:05" style countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

type LiveDrawLike = { event_id: string; started_at: string; duration_ms: number };

export type LivePhase =
  | "none" // no lottery desk this month
  | "unscheduled" // lottery desk waiting, no draw time set
  | "countdown"
  | "alert" // last minute before the draw
  | "open" // spin button unlocked for the next desk
  | "spinning" // someone spun; everyone watches
  | "done"; // every lottery desk has a winner

/**
 * Where the month's live draw stands. Lottery desks are drawn in desk order:
 * Desk 2 opens only after Desk 1's spin has finished animating.
 */
export function liveDrawPhase<E extends EventLike & { id: string }, D extends LiveDrawLike>(opts: {
  now: number;
  drawAt: string | null | undefined;
  override?: boolean;
  events: E[];
  draws: D[];
}): { phase: LivePhase; target: E | null; msLeft: number; spinning: D | null } {
  const { now, drawAt, events, draws } = opts;
  const ids = new Set(events.map((e) => e.id));
  const monthDraws = draws.filter((d) => ids.has(d.event_id));
  const spinning =
    monthDraws.find((d) => now < new Date(d.started_at).getTime() + d.duration_ms) ?? null;
  const msLeft = drawAt ? new Date(drawAt).getTime() - now : Number.POSITIVE_INFINITY;
  if (spinning) return { phase: "spinning", target: null, msLeft, spinning };
  if (!events.some((e) => e.selection_type === "lottery"))
    return { phase: "none", target: null, msLeft, spinning: null };
  const pending = eventsNeedingDraw(events).filter((e) => !monthDraws.some((d) => d.event_id === e.id));
  const target = pending[0] ?? null;
  if (!target) return { phase: "done", target: null, msLeft, spinning: null };
  if (opts.override || msLeft <= 0) return { phase: "open", target, msLeft, spinning: null };
  if (!drawAt) return { phase: "unscheduled", target, msLeft, spinning: null };
  return { phase: msLeft <= LIVE_ALERT_MS ? "alert" : "countdown", target, msLeft, spinning: null };
}

/** Server-side gate for "Spin the Wheel": null when allowed, else the reason. */
export function liveSpinProblem<E extends EventLike & { id: string }, D extends LiveDrawLike>(opts: {
  now: number;
  drawAt: string | null | undefined;
  override?: boolean;
  events: E[];
  draws: D[];
  eventId: string;
}): string | null {
  const s = liveDrawPhase(opts);
  if (s.phase === "spinning") return "The wheel is already spinning";
  if (s.phase === "done" || s.phase === "none") return "Every lottery desk this month already has a winner";
  if (s.phase === "unscheduled") return "The Admin hasn't scheduled the live draw yet";
  if (s.phase !== "open") return "The live draw hasn't started yet";
  if (s.target?.id !== opts.eventId) return `Spin ${deskLabel(s.target!.event_no).en} first`;
  return null;
}
